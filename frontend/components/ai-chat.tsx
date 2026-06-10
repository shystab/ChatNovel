"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal, flushSync } from "react-dom";
import { useWebSocket } from "@/hooks/use-websocket";
import { api, authHeaders } from "@/lib/api";
import { Send, Sparkles, ChevronDown, User, PanelRightClose, Library, Trash2, Plus, FileText, Database, Lightbulb } from "lucide-react";
import type { Theme, ThemeColors } from "@/hooks/use-theme";
import { AIAgentStep, Chapter, Conversation } from "@/types/api";
import DocumentSelector from "@/components/document-selector";
import ConfirmDialog from "@/components/confirm-dialog";

interface Preset {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface PresetListResponse {
  items: Preset[];
  total: number;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  isStreaming?: boolean;
}

interface AIChatProps {
  onInsertContent: (content: string) => void;
  onReplaceContent?: (content: string) => void;
  getEditorContent: () => string;
  theme: Theme;
  colors: ThemeColors;
  onToggleRight?: () => void;
  bookId?: number | null;
  chapters?: Chapter[];
  currentChapterId?: number | null;
}

const CONV_ID_KEY = "ai-conversation-id";

function conversationPreview(conv: Conversation) {
  const last = [...(conv.messages ?? [])].reverse().find(m => m.content?.trim());
  if (!last) return conv.selected_doc_ids?.length ? "已选择参考文档" : "暂无消息";
  const prefix = last.role === "user" ? "我：" : "AI：";
  const content = last.content.replace(/\s+/g, " ").trim();
  return `${prefix}${content.length > 24 ? content.slice(0, 24) + "…" : content}`;
}

function conversationMeta(conv: Conversation) {
  const messageCount = conv.messages?.length ?? 0;
  const docCount = conv.selected_doc_ids?.length ?? 0;
  const date = new Date(conv.update_time);
  const time = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts = [`${messageCount} 条消息`];
  if (docCount > 0) parts.push(`${docCount} 份参考`);
  if (time) parts.push(time);
  return parts.join(" · ");
}


const AGENT_LABELS: Record<string, string> = {
  layered_context: "自动分层上下文",
  get_current_chapter: "读取当前章节",
  get_nearby_chapters_summary: "读取附近章节摘要",
  search_my_chapters: "检索本书章节",
  search_external_reference: "检索外部资料",
  get_book_outline: "读取全书提纲",
  extract_foreshadowing_candidates: "扫描伏笔候选",
};

export default function AIChat({ onInsertContent, getEditorContent, theme, onToggleRight, bookId, chapters = [], currentChapterId = null }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [detailedAnalysis, setDetailedAnalysis] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const dropdownAreaRef = useRef<HTMLDivElement>(null);
  const presetBtnRef = useRef<HTMLButtonElement>(null);
  const { isStreaming, connect } = useWebSocket();
  const streamBufferRef = useRef("");
  const isFirstExchangeRef = useRef(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  // ── 对话持久化（后端） ────────────────────────────
  const convIdRef = useRef<number | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationTitle, setConversationTitle] = useState("新对话");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showConvDropdown, setShowConvDropdown] = useState(false);
  const [convDropdownRect, setConvDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [presetDropdownRect, setPresetDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);

  // ── 文档选择 ──────────────────────────────────
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [agentSteps, setAgentSteps] = useState<AIAgentStep[]>([]);

  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.listConversations();
      setConversations(list);
    } catch {}
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/presets/`, { headers: authHeaders() });
      const data: PresetListResponse = await res.json();
      setPresets(data.items);
      const enabled = data.items.find(p => p.is_enabled);
      if (enabled) setSelectedPresetId(enabled.id);
    } catch {}
  }, [BASE]);

  const resetDraftConversation = useCallback(() => {
    setMessages([]);
    convIdRef.current = null;
    setCurrentConversationId(null);
    setConversationTitle("新对话");
    setSelectedDocIds([]);
    isFirstExchangeRef.current = true;
    localStorage.removeItem(CONV_ID_KEY);
    localStorage.removeItem("ai-chat-messages:v1");
  }, []);

  const ensureConversation = useCallback(async () => {
    if (convIdRef.current) return convIdRef.current;
    const conv = await api.createConversation({ title: "新对话" });
    convIdRef.current = conv.id;
    setCurrentConversationId(conv.id);
    setConversationTitle(conv.title || "新对话");
    localStorage.setItem(CONV_ID_KEY, String(conv.id));
    setConversations(prev => [conv, ...prev.filter(item => item.id !== conv.id)]);
    return conv.id;
  }, []);

  // 启动时：从后端恢复对话
  useEffect(() => {
    async function initConversation() {
      await loadConversations();

      // 尝试读取上次的对话 ID
      const storedId = localStorage.getItem(CONV_ID_KEY);
      if (storedId) {
        try {
          const conv = await api.getConversation(parseInt(storedId, 10));
          if (conv && (conv.messages?.length > 0 || conv.selected_doc_ids?.length > 0 || conv.title !== "新对话")) {
            setMessages(conv.messages as Message[]);
            convIdRef.current = conv.id;
            setCurrentConversationId(conv.id);
            setConversationTitle(conv.title || "新对话");
            setSelectedDocIds(conv.selected_doc_ids ?? []);
            isFirstExchangeRef.current = (conv.messages?.length ?? 0) === 0;
            return;
          }
        } catch {
          // 对话不存在，降级为草稿
        }
      }

      const saved = localStorage.getItem("ai-chat-messages:v1");
      resetDraftConversation();
      if (saved) { try { setMessages(JSON.parse(saved)); } catch {} }
    }
    void initConversation();
  }, [loadConversations, resetDraftConversation]);

  const switchConversation = async (conv: Conversation) => {
    setShowConvDropdown(false);
    setConvDropdownRect(null);
    try {
      const full = await api.getConversation(conv.id);
      const msgs = (full.messages ?? []) as Message[];
      setMessages(msgs);
      convIdRef.current = full.id;
      setCurrentConversationId(full.id);
      setConversationTitle(full.title || "新对话");
      setSelectedDocIds(full.selected_doc_ids ?? []);
      localStorage.setItem(CONV_ID_KEY, String(full.id));
      // 已有消息则不再自动生成标题
      isFirstExchangeRef.current = msgs.length === 0;
    } catch {}
  };

  const renameCurrentConversation = async (newTitle: string) => {
    setIsEditingTitle(false);
    const title = newTitle.trim();
    if (!title) return;
    setConversationTitle(title);
    try {
      const id = await ensureConversation();
      await api.updateConversation(id, { title });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    } catch {}
  };

  // 保存对话到后端（fire-and-forget）
  const persistMessages = (msgs: Message[]) => {
    if (convIdRef.current) {
      api.updateConversation(convIdRef.current, {
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
      }).then(updated => {
        setConversations(prev => [updated, ...prev.filter(conv => conv.id !== updated.id)]);
      }).catch(() => {
        // 降级到 localStorage
        localStorage.setItem("ai-chat-messages:v1", JSON.stringify(msgs));
      });
    } else {
      localStorage.setItem("ai-chat-messages:v1", JSON.stringify(msgs));
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadPresets);
  }, [loadPresets]);

  // 下拉框打开时计算 fixed 定位坐标
  useEffect(() => {
    if (showConvDropdown && dropdownAreaRef.current) {
      const rect = dropdownAreaRef.current.getBoundingClientRect();
      setConvDropdownRect({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) });
    } else {
      setConvDropdownRect(null);
    }
  }, [showConvDropdown]);

  useEffect(() => {
    if (showPresetDropdown && presetBtnRef.current) {
      const rect = presetBtnRef.current.getBoundingClientRect();
      setPresetDropdownRect({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) });
    } else {
      setPresetDropdownRect(null);
    }
  }, [showPresetDropdown]);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  // 自动调整 textarea 高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const addAiMessage = (content: string, isStreaming = false) => {
    setMessages(prev => [...prev, { role: "ai", content, isStreaming }]);
  };

  const updateLastAiMessage = (content: string, isStreaming = false) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === "ai") {
        const next = [...prev.slice(0, -1), { role: "ai" as const, content, isStreaming }];
        if (!isStreaming) persistMessages(next);
        return next;
      }
      return prev;
    });
  };

  const getAiUnavailableMessage = async () => {
    try {
      const health = await api.getAiHealth();
      if (health.configured) return null;
      const providerName = (health.provider || "AI").toUpperCase();
      return `还没有配置 ${providerName} API Key。请先进入设置页填写 API Key，然后再使用 AI 聊天。`;
    } catch {
      return "后端服务暂时不可用。请确认 start-web.cmd 已正常启动，或查看 .run/logs 日志。";
    }
  };


  const startStream = (request: Parameters<typeof connect>[0]) => {
    streamBufferRef.current = "";
    setAgentSteps([]);
    addAiMessage("", true);
    const currentEditorContent = getEditorContent();
    const withExtras = {
      ...request,
      ...(selectedPresetId ? { preset_id: selectedPresetId } : {}),
      ...(bookId ? { book_id: bookId } : {}),
      ...(currentChapterId ? { current_chapter_id: currentChapterId } : {}),
      ...(selectedDocIds.length > 0 ? { selected_doc_ids: selectedDocIds } : {}),
      detailed_analysis: detailedAnalysis,
      ...(currentEditorContent && !request.content ? { content: currentEditorContent } : {}),
    };

    connect(withExtras, {
      onToken: (token) => {
        streamBufferRef.current += token;
        // flushSync 强制每个 token 立即渲染，避免 React 18 批处理合并 WS 消息
        flushSync(() => {
          updateLastAiMessage(streamBufferRef.current, true);
        });
      },
      onAgentStep: (step) => {
        setAgentSteps((current) => {
          const index = current.findIndex((item) => item.id === step.id);
          if (index < 0) return [...current, step];
          const next = [...current];
          next[index] = { ...next[index], ...step };
          return next;
        });
      },
      onDone: () => {
        const finalContent = streamBufferRef.current;

        updateLastAiMessage(finalContent, false);
        setAgentSteps((current) => current.map((step) =>
          step.status === "running" ? { ...step, status: "completed" as const } : step
        ));

        // 首次对话自动生成标题
        if (isFirstExchangeRef.current) {
          isFirstExchangeRef.current = false;
          setMessages(prev => {
            const firstUser = prev.find(m => m.role === "user");
            if (firstUser) generateAutoTitle(firstUser.content);
            return prev;
          });
        }
      },
      onError: (message) => {
        setAgentSteps((current) => current.map((step) =>
          step.status === "running" ? { ...step, status: "failed" as const, detail: message } : step
        ));
        updateLastAiMessage(`出错了：${message}`, false);
      },
    });
  };

  const handleRegenerate = () => {
    // 找到最后一条 user 消息的索引
    let lastUserIdx = -1;
    for (let j = messages.length - 1; j >= 0; j--) {
      if (messages[j].role === "user") {
        lastUserIdx = j;
        break;
      }
    }
    if (lastUserIdx < 0) return;

    // 截断到最后一条 user 消息（移除其后的所有 AI 回复）
    const truncated = messages.slice(0, lastUserIdx + 1);
    const lastUserContent = truncated[lastUserIdx].content;
    setMessages(truncated);
    persistMessages(truncated);

    const historyMessages = truncated.slice(0, -1).map(m => ({
      role: m.role === "ai" ? "assistant" as const : "user" as const,
      content: m.content,
    }));
    historyMessages.push({ role: "user", content: lastUserContent });

    startStream({
      type: "chat",
      messages: historyMessages,
      use_memory: true,
    });
  };

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    try { await ensureConversation(); } catch {}

    const userMsg: Message = { role: "user", content: trimmed };
    const pendingMessages: Message[] = [...messages, userMsg];
    setMessages(pendingMessages);
    persistMessages(pendingMessages);
    setInput("");

    const unavailableMessage = await getAiUnavailableMessage();
    if (unavailableMessage) {
      const finalMessages: Message[] = [...pendingMessages, { role: "ai", content: unavailableMessage }];
      setMessages(finalMessages);
      persistMessages(finalMessages);
      return;
    }

    const historyMessages = messages.map(m => ({
      role: m.role === "ai" ? "assistant" : m.role,
      content: m.content,
    }));
    historyMessages.push({ role: "user", content: trimmed });

    startStream({
      type: "chat",
      messages: historyMessages,
      use_memory: true,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const openDocSelector = async () => {
    try {
      setShowConvDropdown(false);
      setShowPresetDropdown(false);
      setConvDropdownRect(null);
      setPresetDropdownRect(null);
      await ensureConversation();
      setShowDocSelector(true);
    } catch {}
  };

  const handleDocumentSelectionSave = (ids: number[]) => {
    setSelectedDocIds(ids);
    if (!convIdRef.current) return;
    setConversations(prev =>
      prev.map(conv =>
        conv.id === convIdRef.current ? { ...conv, selected_doc_ids: ids } : conv
      )
    );
  };

  const startNewConversation = () => {
    resetDraftConversation();
    setShowConvDropdown(false);
    setConvDropdownRect(null);
  };

  const generateAutoTitle = async (firstUserMsg: string) => {
    if (!convIdRef.current) return;
    let title = firstUserMsg.trim();
    // 截取前 15 字
    if (title.length > 15) title = title.slice(0, 15) + "…";
    if (!title) return;
    setConversationTitle(title);
    try {
      await api.updateConversation(convIdRef.current, { title });
      setConversations(prev => prev.map(c => c.id === convIdRef.current ? { ...c, title } : c));
    } catch {}
  };


  const deleteConversation = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(conv);
  };

  const confirmDeleteConversation = async () => {
    if (!deleteTarget) return;
    setDeletingConversation(true);
    try {
      await api.deleteConversation(deleteTarget.id);
      setConversations(prev => prev.filter(c => c.id !== deleteTarget.id));
      if (deleteTarget.id === convIdRef.current) {
        resetDraftConversation();
      }
      setDeleteTarget(null);
    } catch {
    } finally {
      setDeletingConversation(false);
    }
  };

  const cleanupEmptyConversations = async () => {
    setCleanupStatus("清理中...");
    try {
      const result = await api.cleanupEmptyConversations();
      if (currentConversationId && result.deleted_ids.includes(currentConversationId)) {
        resetDraftConversation();
      }
      await loadConversations();
      setCleanupStatus(result.deleted_count > 0 ? `已清理 ${result.deleted_count} 个空对话` : "没有空对话");
    } catch {
      setCleanupStatus("清理失败");
    }
  };

  const busy = isStreaming;

  // ── 主题相关样式 ──────────────────────────────────────────────────────────────
  const borderClass = theme === 'dark' ? 'border-slate-700/60' : theme === 'sepia' ? 'border-amber-200' : 'border-slate-100';
  const bgClass = theme === 'dark' ? 'bg-slate-900' : theme === 'sepia' ? 'bg-amber-50' : 'bg-white';
  const mutedClass = theme === 'dark' ? 'text-slate-500' : theme === 'sepia' ? 'text-amber-500' : 'text-slate-400';
  const textClass = theme === 'dark' ? 'text-slate-300' : theme === 'sepia' ? 'text-amber-700' : 'text-slate-700';
  const headingClass = theme === 'dark' ? 'text-slate-100' : theme === 'sepia' ? 'text-amber-900' : 'text-slate-800';
  const hoverBgClass = theme === 'dark' ? 'hover:bg-slate-800' : theme === 'sepia' ? 'hover:bg-amber-100' : 'hover:bg-slate-50';
  const inputBgClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-slate-500 focus:bg-slate-700' : theme === 'sepia' ? 'bg-amber-100/50 border-amber-200 text-amber-900 placeholder:text-amber-400 focus:border-amber-400 focus:bg-amber-50' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-300 focus:border-slate-400 focus:bg-white';
  const sendBtnClass = theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600' : theme === 'sepia' ? 'bg-amber-800 hover:bg-amber-700 disabled:bg-amber-200 disabled:text-amber-400' : 'bg-slate-900 hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-300';
  const dropdownItemHover = theme === 'dark' ? 'hover:bg-slate-700' : theme === 'sepia' ? 'hover:bg-amber-100' : 'hover:bg-slate-50';
  const userMsgBg = theme === 'dark' ? 'bg-slate-700 text-slate-100' : theme === 'sepia' ? 'bg-amber-800 text-white' : 'bg-slate-900 text-white';
  const inputAreaBg = theme === 'dark' ? 'bg-slate-900 border-slate-700/60' : theme === 'sepia' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100';
  const selectedDropdownBg = theme === 'dark' ? 'bg-slate-700/70' : theme === 'sepia' ? 'bg-amber-100/80' : 'bg-slate-100';
  const badgeClass = theme === 'dark' ? 'bg-slate-700 text-slate-200' : theme === 'sepia' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
  const contextBarBg = theme === 'dark' ? 'bg-slate-950/45' : theme === 'sepia' ? 'bg-amber-50/55' : 'bg-slate-50/70';
  const contextPill = theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400' : theme === 'sepia' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500';
  const contextPillActive = theme === 'dark' ? 'bg-slate-800 border-slate-600 text-slate-200' : theme === 'sepia' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-100 border-slate-300 text-slate-800';
  const currentChapter = currentChapterId ? chapters.find(chapter => chapter.id === currentChapterId) ?? null : null;
  const selectedPreset = selectedPresetId ? presets.find(preset => preset.id === selectedPresetId) ?? null : null;
  const parseAiContent = (content: string, streaming: boolean) => {
    if (streaming || !content) return { analysis: content, prose: null };
    const sep = content.match(/\n-{3,}\n/);
    if (!sep || sep.index === undefined) return { analysis: content, prose: null };
    const idx = sep.index;
    const analysis = content.slice(0, idx).trim();
    const prose = content.slice(idx + sep[0].length).trim();
    return { analysis: analysis || null, prose: prose || null };
  };
  const renderAiContent = (msg: Message) => {
    const parts = parseAiContent(msg.content, !!msg.isStreaming);
    const showProse = !msg.isStreaming && !!parts.prose;
    const showAnalysis = !msg.isStreaming && !!parts.analysis && !!parts.prose;
    if (msg.isStreaming && msg.content === "")
      return <div className="flex space-x-1 py-1"><span className={`w-1.5 h-1.5 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'} rounded-full animate-bounce`} style={{ animationDelay: "0ms" }} /><span className={`w-1.5 h-1.5 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'} rounded-full animate-bounce`} style={{ animationDelay: "150ms" }} /><span className={`w-1.5 h-1.5 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'} rounded-full animate-bounce`} style={{ animationDelay: "300ms" }} /></div>;
    if (showProse)
      return <>{showAnalysis && <div className={`text-sm leading-relaxed ${textClass}`}><p className="whitespace-pre-wrap">{parts.analysis}</p></div>}<div className={`relative group rounded-lg border-l-2 border-blue-500/50 pl-3 py-2 pr-2 ${theme === 'dark' ? 'bg-slate-800/40' : theme === 'sepia' ? 'bg-amber-100/30' : 'bg-slate-50'}`}><div className={`text-sm leading-relaxed ${textClass}`}><p className="whitespace-pre-wrap">{parts.prose}</p></div><div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onInsertContent(parts.prose!)} className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-400 px-2 py-1 rounded" type="button"><Plus size={11} /> 写入编辑器</button><button onClick={async () => { try { await navigator.clipboard.writeText(parts.prose!); } catch {} }} className={`flex items-center gap-1 text-[10px] ${mutedClass} px-2 py-1 rounded`} type="button">复制</button><button onClick={handleRegenerate} className={`flex items-center gap-1 text-[10px] ${mutedClass} px-2 py-1 rounded`} type="button">重新生成</button></div></div></>;
    return <><div className={`text-sm leading-relaxed ${textClass} ${msg.isStreaming ? "opacity-80" : ""}`}><p className="whitespace-pre-wrap">{msg.content}{msg.isStreaming && <span className={`inline-block w-0.5 h-3.5 ${theme === 'dark' ? 'bg-slate-400' : 'bg-slate-500'} ml-0.5 animate-caret align-middle`} />}</p></div>{!msg.isStreaming && msg.content && <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onInsertContent(msg.content)} className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-400 px-2 py-1 rounded" type="button"><Plus size={11} /> 写入编辑器</button><button onClick={async () => { try { await navigator.clipboard.writeText(msg.content); } catch {} }} className={`flex items-center gap-1 text-[10px] ${mutedClass} px-2 py-1 rounded`} type="button">复制</button><button onClick={handleRegenerate} className={`flex items-center gap-1 text-[10px] ${mutedClass} px-2 py-1 rounded`} type="button">重新生成</button></div>}</>;
  };

  return (
    <div className={`flex flex-col h-full min-h-0 ${bgClass} border-l ${borderClass}`}>
      {/* 顶部栏 */}
      <header ref={topBarRef} className={`px-3 py-2 border-b ${borderClass} flex items-center gap-2 ${bgClass} shrink-0`}>
        {/* 对话选择器 */}
        <div className="relative flex-1 min-w-0" ref={dropdownAreaRef}>
          <div className="flex items-center gap-1">
            {isEditingTitle ? (
              <input
                autoFocus
                value={conversationTitle}
                onChange={e => setConversationTitle(e.target.value)}
                onBlur={e => renameCurrentConversation(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") renameCurrentConversation(conversationTitle);
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className={`flex-1 min-w-0 text-xs font-semibold px-2 py-1 rounded-lg border ${inputBgClass} focus:outline-none`}
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className={`flex-1 min-w-0 text-left text-xs font-semibold ${headingClass} px-2 py-1 rounded-lg ${hoverBgClass} truncate transition-colors`}
                title="点击重命名对话"
                type="button"
              >
                {conversationTitle}
              </button>
            )}
            <button
              onClick={() => setShowConvDropdown(v => !v)}
              className={`shrink-0 p-1 ${mutedClass} ${hoverBgClass} rounded-lg transition-colors`}
              title="切换对话"
              type="button"
            >
              <ChevronDown size={12} className={`transition-transform ${showConvDropdown ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* 对话下拉列表（portal 到 body，完全不受父级 CSS 影响） */}
          {showConvDropdown && convDropdownRect && document.body && createPortal(
            <div
              className={`fixed z-[9999] border rounded-lg shadow-lg overflow-y-auto max-h-80`}
              style={{
                top: convDropdownRect.top,
                left: convDropdownRect.left,
                width: Math.max(convDropdownRect.width, 240),
                backgroundColor: theme === 'dark' ? '#1e293b' : theme === 'sepia' ? '#fffbeb' : '#ffffff',
                borderColor: theme === 'dark' ? '#334155' : theme === 'sepia' ? '#fde68a' : '#e2e8f0',
              }}
            >
              <div className={`px-3 py-2 border-b ${borderClass} flex items-center justify-between`}>
                <span className={`text-[9px] font-bold ${mutedClass} uppercase tracking-widest`}>对话列表</span>
                <button
                  onClick={startNewConversation}
                  className={`inline-flex items-center gap-1 text-[10px] ${textClass} ${hoverBgClass} px-2 py-1 rounded-md transition-colors`}
                  type="button"
                >
                  <Plus size={11} />
                  新对话
                </button>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {conversations.length === 0 && (
                  <p className={`text-[10px] ${mutedClass} px-3 py-3 text-center`}>暂无对话记录</p>
                )}
                {conversations.map(conv => (
                  <div key={conv.id} className="relative group">
                    <button
                      onClick={() => switchConversation(conv)}
                      className={`w-full px-3 py-2.5 pr-8 text-left ${dropdownItemHover} transition-colors ${conv.id === currentConversationId ? selectedDropdownBg : ''}`}
                      type="button"
                    >
                      <div className={`text-xs font-semibold truncate ${headingClass}`}>{conv.title || "新对话"}</div>
                      <div className={`text-[10px] ${mutedClass} mt-0.5 truncate`}>{conversationPreview(conv)}</div>
                      <div className={`text-[9px] ${mutedClass} mt-0.5`}>{conversationMeta(conv)}</div>
                    </button>
                    <button
                      onClick={(e) => deleteConversation(conv, e)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'text-slate-500 hover:text-red-400 hover:bg-slate-600' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'}`}
                      type="button"
                      title="删除对话"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className={`px-3 py-2 border-t ${borderClass} space-y-1.5`}>
                <button
                  onClick={() => {
                    const firstUser = messages.find(m => m.role === "user");
                    if (firstUser) { setShowConvDropdown(false); generateAutoTitle(firstUser.content); }
                  }}
                  disabled={!messages.some(m => m.role === "user")}
                  className={`w-full text-[10px] ${mutedClass} ${dropdownItemHover} py-1 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
                  type="button"
                  title="根据对话内容自动生成标题"
                >
                  ✦ AI 自动生成名称
                </button>
                <button
                  onClick={cleanupEmptyConversations}
                  className={`w-full text-[10px] ${mutedClass} ${dropdownItemHover} py-1 rounded-md transition-colors`}
                  type="button"
                >
                  清理空对话
                </button>
                {cleanupStatus && (
                  <p className={`text-[9px] ${mutedClass} text-center`}>{cleanupStatus}</p>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* 人格预设选择器 */}
          <div className="relative">
            <button
              ref={presetBtnRef}
              onClick={() => setShowPresetDropdown(v => !v)}
              className={`p-1.5 ${mutedClass} ${hoverBgClass} transition-colors rounded-lg flex items-center gap-0.5`}
              title="选择人格预设"
              type="button"
              data-preset-toggle="true"
            >
              <User size={13} />
              {selectedPresetId && <span className={`text-[9px] font-bold px-1 rounded ${badgeClass}`}>✓</span>}
            </button>
            {showPresetDropdown && presetDropdownRect && document.body && createPortal(
              <div
                className={`fixed z-[9999] border rounded-lg shadow-lg overflow-y-auto max-h-80`}
                style={{
                  top: presetDropdownRect.top,
                  left: presetDropdownRect.left,
                  width: presetDropdownRect.width,
                  backgroundColor: theme === 'dark' ? '#1e293b' : theme === 'sepia' ? '#fffbeb' : '#ffffff',
                  borderColor: theme === 'dark' ? '#334155' : theme === 'sepia' ? '#fde68a' : '#e2e8f0',
                }}
              >
                <div className={`px-3 py-2 border-b ${borderClass}`}>
                  <span className={`text-[9px] font-bold ${mutedClass} uppercase tracking-widest`}>人格预设</span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedPresetId(null); setShowPresetDropdown(false); setPresetDropdownRect(null); }}
                    className={`w-full px-3 py-2.5 text-left ${dropdownItemHover} transition-colors ${selectedPresetId === null ? selectedDropdownBg : ''}`}
                    type="button"
                  >
                    <div className={`text-xs font-semibold ${headingClass}`}>默认人格</div>
                    <div className={`text-[10px] ${mutedClass} mt-0.5`}>使用系统内置写作助手人格</div>
                  </button>
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => { setSelectedPresetId(preset.id); setShowPresetDropdown(false); setPresetDropdownRect(null); }}
                      className={`w-full px-3 py-2.5 text-left ${dropdownItemHover} transition-colors ${selectedPresetId === preset.id ? selectedDropdownBg : ''}`}
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <div className={`text-xs font-semibold ${headingClass}`}>{preset.name}</div>
                        {preset.is_enabled && <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${badgeClass}`}>启用</span>}
                      </div>
                      {preset.description && <div className={`text-[10px] ${mutedClass} mt-0.5`}>{preset.description}</div>}
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* 知识库文档选择 */}
          <button
            onClick={openDocSelector}
            className={`p-1.5 ${mutedClass} ${hoverBgClass} transition-colors rounded-lg flex items-center space-x-0.5`}
            title="选择参考文档"
            type="button"
          >
            <Library size={13} />
            {selectedDocIds.length > 0 && <span className="text-[9px] font-bold text-blue-500">{selectedDocIds.length}</span>}
          </button>

          {/* 深度分析开关 */}
          <button
            onClick={() => setDetailedAnalysis(v => !v)}
            className={`p-1.5 transition-colors rounded-lg flex items-center gap-0.5 ${detailedAnalysis ? "text-blue-500 bg-blue-500/10" : mutedClass + " " + hoverBgClass}`}
            title="深度分析模式：AI 会先分析上下文和写作策略，再输出正文"
            type="button"
          >
            <Lightbulb size={13} />
          </button>

          {/* 关闭 AI 面板 */}
          {onToggleRight && (
            <button
              onClick={onToggleRight}
              className={`p-1.5 ${mutedClass} ${hoverBgClass} transition-colors rounded-lg`}
              title="收起 AI 面板"
              type="button"
            >
              <PanelRightClose size={13} />
            </button>
          )}
        </div>
      </header>

      <div className={`px-3 py-2 border-b ${borderClass} ${contextBarBg} shrink-0`}>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-flex max-w-full items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${currentChapter ? contextPillActive : contextPill}`}
            title={currentChapter ? `当前章节：${currentChapter.title}` : "还没有选择章节"}
          >
            <FileText size={11} className="shrink-0" />
            <span className="truncate max-w-[11rem]">{currentChapter ? currentChapter.title : "未选章节"}</span>
          </span>
          <span
            className={`inline-flex max-w-full items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${selectedPreset ? contextPillActive : contextPill}`}
            title={selectedPreset ? `当前人格：${selectedPreset.name}` : "使用默认人格"}
          >
            <User size={11} className="shrink-0" />
            <span className="truncate max-w-[9rem]">{selectedPreset ? selectedPreset.name : "默认人格"}</span>
          </span>
          <button
            type="button"
            onClick={openDocSelector}
            className={`inline-flex max-w-full items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors ${selectedDocIds.length > 0 ? contextPillActive : contextPill} ${dropdownItemHover}`}
            title={selectedDocIds.length > 0 ? "外部语料检索会优先限制在已选文档" : "未选择外部参考语料"}
          >
            <Library size={11} className="shrink-0" />
            <span>{selectedDocIds.length > 0 ? `语料 ${selectedDocIds.length}` : "未选语料"}</span>
          </button>
          <span
            className={`inline-flex max-w-full items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${bookId ? contextPillActive : contextPill}`}
            title={bookId ? "AI 可按需检索当前作品的章节内容" : "没有书籍上下文"}
          >
            <Database size={11} className="shrink-0" />
            <span>{bookId ? "可检索全书" : "无书籍上下文"}</span>
          </span>
        </div>
      </div>

      <DocumentSelector
        conversationId={currentConversationId}
        isOpen={showDocSelector}
        onClose={() => setShowDocSelector(false)}
        initialSelectedIds={selectedDocIds}
        onSave={handleDocumentSelectionSave}
        theme={theme}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除对话"
        description={`确定要删除“${deleteTarget?.title || "新对话"}”吗？这个操作不可撤销。`}
        confirmLabel="删除"
        tone="danger"
        theme={theme}
        busy={deletingConversation}
        onConfirm={confirmDeleteConversation}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col items-center justify-center space-y-4 py-8">
            <div className={`w-9 h-9 rounded-2xl ${theme === 'dark' ? 'bg-slate-800' : theme === 'sepia' ? 'bg-amber-100' : 'bg-slate-50'} flex items-center justify-center`}>
              <Sparkles size={16} className={mutedClass} />
            </div>
            <div className="text-center space-y-1">
              <p className={`text-xs font-semibold ${textClass}`}>AI 写作助手</p>
              <p className={`text-[10px] ${mutedClass}`}>输入你的写作需求</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          // 在当前正在流式输出的 AI 消息之前插入 Agent 步骤
          const showAgentBefore = msg.role === 'ai' && msg.isStreaming && agentSteps.length > 0
            && i === messages.length - 1;

          return (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {showAgentBefore && agentSteps.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                {agentSteps.map(step => {
                  const label = AGENT_LABELS[step.title] || step.title;
                  const dot = step.status === "running" ? "●" : step.status === "failed" ? "✕" : "✓";
                  const color = step.status === "running"
                    ? "text-orange-500"
                    : step.status === "failed"
                      ? "text-red-500"
                      : "text-emerald-500";
                  return (
                    <span key={step.id} className={`text-[11px] font-medium ${color}`}>
                      {dot} {label}
                    </span>
                  );
                })}
              </div>
            )}
            {msg.role === "user" ? (
              <div className={`max-w-[90%] ${userMsgBg} text-sm px-3 py-2 rounded-2xl rounded-tr-sm leading-relaxed`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[96%] space-y-2">
                {renderAiContent(msg)}
              </div>
            )}
          </div>
        );
        })}
      </div>

      {/* 输入区 */}
      <div className={`p-2.5 border-t ${inputAreaBg} relative shrink-0`}>
        <div className="flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={busy ? "AI 正在思考…" : "输入写作需求或问题"}
            disabled={busy}
            rows={1}
            className={`flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all resize-none leading-relaxed disabled:opacity-50 ${inputBgClass}`}
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || busy}
            className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all ${sendBtnClass}`}
            type="button"
            title="发送"
            aria-label="发送"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
      {/* Portal 遮罩层 — 在 body 层级捕获外部点击 */}
      {(showConvDropdown || showPresetDropdown) && document.body && createPortal(
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => { setShowConvDropdown(false); setShowPresetDropdown(false); setConvDropdownRect(null); setPresetDropdownRect(null); }}
        />,
        document.body
      )}
    </div>
  );
}
