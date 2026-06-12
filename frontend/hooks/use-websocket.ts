import { useState, useEffect, useRef, useCallback } from "react";
import { AIAgentStep, AIWSRequest, AIWSMessage } from "@/types/api";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/ai/ws";
const ACCESS_TOKEN = process.env.NEXT_PUBLIC_APP_ACCESS_TOKEN || "";
const AUTH_TOKEN_KEY = "chatnovel-auth-token";

function withAccessToken(url: string) {
  const parsed = new URL(url);
  if (ACCESS_TOKEN) parsed.searchParams.set("access_token", ACCESS_TOKEN);
  const authToken = typeof window === "undefined" ? "" : localStorage.getItem(AUTH_TOKEN_KEY) || "";
  if (authToken) parsed.searchParams.set("auth_token", authToken);
  return parsed.toString();
}

type WebSocketHandlers = {
  onToken?: (token: string) => void;
  onAnalysis?: (data: unknown) => void;
  onAgentStep?: (step: AIAgentStep) => void;
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
      const previous = wsRef.current;
      wsRef.current = null;
      previous.onclose = null;
      previous.close();
    }

    setIsStreaming(true);
    setAiSuggestion("");
    setError(null);

    const ws = new WebSocket(withAccessToken(WS_BASE_URL));
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
        case "agent_step":
          handlers?.onAgentStep?.(data.step);
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
      if (wsRef.current === ws) wsRef.current = null;
      setIsStreaming(false);
      if (!settled) {
        const message = "AI 连接已断开，请检查后端服务或 API Key 设置";
        setError(message);
        handlers?.onError?.(message);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    wsRef.current = null;
    ws.onclose = null;
    ws.close();
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return disconnect;
  }, [disconnect]);

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
