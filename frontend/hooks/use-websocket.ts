import { useState, useEffect, useRef, useCallback } from "react";
import { AIWSRequest, AIWSMessage } from "@/types/api";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/ai/ws";

type WebSocketHandlers = {
  onToken?: (token: string) => void;
  onAnalysis?: (data: unknown) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

export function useWebSocket() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((request: AIWSRequest, handlers?: WebSocketHandlers) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsStreaming(true);
    setAiSuggestion("");
    setError(null);

    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;
    let settled = false;

    ws.onopen = () => {
      ws.send(JSON.stringify(request));
    };

    ws.onmessage = (event) => {
      let data: AIWSMessage;
      try {
        data = JSON.parse(event.data) as AIWSMessage;
      } catch {
        return;
      }
      
      switch (data.type) {
        case "token":
          setAiSuggestion((prev) => prev + data.text);
          handlers?.onToken?.(data.text);
          break;
        case "analysis":
          setAnalysisResult(data.data);
          handlers?.onAnalysis?.(data.data);
          break;
        case "done":
          settled = true;
          setIsStreaming(false);
          handlers?.onDone?.();
          ws.close();
          break;
        case "error":
          settled = true;
          setIsStreaming(false);
          setError(data.message);
          handlers?.onError?.(data.message);
          ws.close();
          break;
      }
    };

    ws.onerror = () => {
      settled = true;
      setIsStreaming(false);
      setError("WebSocket connection error");
      handlers?.onError?.("WebSocket connection error");
    };

    ws.onclose = () => {
      setIsStreaming(false);
      if (!settled) {
        const message = "AI 连接已断开，请检查后端服务或 API Key 设置";
        setError(message);
        handlers?.onError?.(message);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isStreaming,
    aiSuggestion,
    analysisResult,
    error,
    connect,
    disconnect,
    setAiSuggestion,
  };
}
