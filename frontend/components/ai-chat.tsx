"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { api, authHeaders } from "@/lib/api";
import { Send, ArrowLeftRight, Sparkles, ChevronDown, ChevronUp, User, PanelRightClose, Library, Trash2, Plus, FileText, Database, Search, Loader2, CheckCircle2, XCircle, Brain } from "lucide-react";
import type { Theme, ThemeColors } from "@/hooks/use-theme";
import { AgentEditPlan, AIAgentStep, Chapter, Conversation } from "@/types/api";
import DocumentSelector from "@/components/document-selector";
import ConfirmDialog from "@/components/confirm-dialog";
import AgentApplyReview from "@/components/agent-apply-review";

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

function stripHtmlToText(value: string) {
  return (value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function joinBlocks(...parts: string[]) {
  return parts.map(part => part.trim()).filter(Boolean).join("\n\n");
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

function applyAgentPlanPreview(currentHtml: string, plan: AgentEditPlan) {
  let next = stripHtmlToText(currentHtml);
  const warnings: string[] = [];

  if (!plan.operations.length) {
    warnings.push("AI 没有返回可应用的修改步骤");
    return { preview: next, warnings };
  }

  for (const op of plan.operations) {
    const content = (op.content || "").trim();
    if (op.action === "append") {
      next = joinBlocks(next, content);
      continue;
    }
    if (op.action === "prepend") {
      next = joinBlocks(content, next);
      continue;
    }
    if (op.action === "replace_all") {
      next = content;
      continue;
    }
    if (op.action === "insert_before" || op.action === "insert_after") {
      const anchor = (op.anchor || "").trim();
      const index = anchor ? next.indexOf(anchor) : -1;
      if (index < 0) {
        warnings.push(`没有找到定位文本，已把“${op.action}”降级为追加`);
        next = joinBlocks(next, content);
        continue;
      }
      if (next.indexOf(anchor, index + anchor.length) >= 0) {
        warnings.push("定位文本出现多次，预览使用第一次匹配");
      }
      const insertAt = op.action === "insert_after" ? index + anchor.length : index;
      next = `${next.slice(0, insertAt).trimEnd()}\n\n${content}\n\n${next.slice(insertAt).trimStart()}`.trim();
      continue;
    }
    if (op.action === "replace_text") {
      const findText = (op.find_text || "").trim();
      const index = findText ? next.indexOf(findText) : -1;
      if (index < 0) {
        warnings.push("没有找到要替换的原文，这一步已跳过");
        continue;
      }
      if (next.indexOf(findText, index + findText.length) >= 0) {
        warnings.push("替换原文出现多次，预览只替换第一次匹配");
      }
      next = `${next.slice(0, index)}${content}${next.slice(index + findText.length)}`.trim();
    }
  }

  return { preview: next, warnings };
}

export default function AIChat({ onInsertContent, onReplaceContent, getEditorContent, theme, onToggleRight, bookId, chapters = [], currentChapterId = null }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPlanningEdit, setIsPlanningEdit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const { isStreaming, connect } = useWebSocket();
  const streamBufferRef = useRef("");
  const isFirstExchangeRef = useRef(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // ── 对话持久化（后端） ────────────────────────────
  const convIdRef = useRef<number | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationTitle, setConversationTitle] = useState("新对话");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showConvDropdown, setShowConvDropdown] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);

  // ── 文档选择 ──────────────────────────────────
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [applyProposal, setApplyProposal] = useState("");
  const [agentPlan, setAgentPlan] = useState<AgentEditPlan | null>(null);
  const [agentPreview, setAgentPreview] = useState("");
  const [agentWarnings, setAgentWarnings] = useState<string[]>([]);
  const [agentSteps, setAgentSteps] = useState<AIAgentStep[]>([]);
  const [agentRunCollapsed, setAgentRunCollapsed] = useState(false);

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
    localStorage.removeItem("ai-chat-messages");
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

      const saved = localStorage.getItem("ai-chat-messages");
      resetDraftConversation();
      if (saved) { try { setMessages(JSON.parse(saved)); } catch {} }
    }
    void initConversation();
  }, [loadConversations, resetDraftConversation]);

  const switchConversation = async (conv: Conversation) => {
    setShowConvDropdown(false);
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
        localStorage.setItem("ai-chat-messages", JSON.stringify(msgs));
      });
    } else {
      localStorage.setItem("ai-chat-messages", JSON.stringify(msgs));
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadPresets);
  }, [loadPresets]);

  useEffect(() => {
    if (!showConvDropdown && !showPresetDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (topBarRef.current?.contains(event.target as Node)) return;
      setShowConvDropdown(false);
      setShowPresetDropdown(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showConvDropdown, showPresetDropdown]);

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
    setAgentRunCollapsed(false);
    addAiMessage("", true);
    const currentEditorContent = getEditorContent();
    const withExtras = {
      ...request,
      ...(selectedPresetId ? { preset_id: selectedPresetId } : {}),
      ...(bookId ? { book_id: bookId } : {}),
      ...(currentChapterId ? { current_chapter_id: currentChapterId } : {}),
      ...(selectedDocIds.length > 0 ? { selected_doc_ids: selectedDocIds } : {}),
      // 确保 content 字段存在（用于工具调用）
      ...(currentEditorContent && !request.content ? { content: currentEditorContent } : {}),
    };

    connect(withExtras, {
      onToken: (token) => {
        streamBufferRef.current += token;
        updateLastAiMessage(streamBufferRef.current, true);
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

  const handleStreamFallback = async (text: string) => {
    const trimmed = text.trim();
    
    if (!trimmed || isStreaming) return;

    try {
      await ensureConversation();
    } catch {
      // 后端不可用时仍允许本地临时对话
    }

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    persistMessages(newMessages);
    setInput("");

    const unavailableMessage = await getAiUnavailableMessage();
    if (unavailableMessage) {
      const finalMessages: Message[] = [...newMessages, { role: "ai", content: unavailableMessage }];
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

  const handleAgentEdit = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || isPlanningEdit) return;

    const currentEditorContent = getEditorContent();

    setIsPlanningEdit(true);
    setApplyProposal("");
    setAgentPlan(null);
    setAgentPreview("");
    setAgentWarnings([]);

    try {
      await ensureConversation();
    } catch {}

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
      setIsPlanningEdit(false);
      return;
    }

    const historyMessages = messages.map(m => ({
      role: m.role === "ai" ? "assistant" : m.role,
      content: m.content,
    }));
    historyMessages.push({ role: "user", content: trimmed });

    try {
      const plan = await api.createAgentEditPlan({
        instruction: trimmed,
        messages: historyMessages,
        use_memory: true,
        content: currentEditorContent,
        book_id: bookId ?? null,
        current_chapter_id: currentChapterId ?? null,
        selected_doc_ids: selectedDocIds,
      });
      if (plan.operations.length > 0) {
        const { preview, warnings } = applyAgentPlanPreview(currentEditorContent, plan);
        setAgentPlan(plan);
        setAgentPreview(preview);
        setAgentWarnings(warnings);
      } else {
        setAgentPlan(null);
        setAgentPreview("");
        setAgentWarnings([]);
      }

      const riskText = plan.risk === "high" ? "高风险" : plan.risk === "low" ? "低风险" : "中风险";
      const aiContent = plan.operations.length
        ? `${plan.reply || `已生成修改方案：${plan.summary || "可确认写作修改"}`}（${plan.operations.length} 步，${riskText}）。`
        : (plan.reply || "没有生成可应用的修改步骤，可以换一种更具体的说法再试。");
      const finalMessages: Message[] = [...pendingMessages, { role: "ai", content: aiContent }];
      setMessages(finalMessages);
      persistMessages(finalMessages);
    } catch (error) {
      console.warn("Agent decision failed, falling back to streaming chat", error);
      await handleStreamFallback(trimmed);
    } finally {
      setIsPlanningEdit(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAgentEdit(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const openDocSelector = async () => {
    try {
      setShowConvDropdown(false);
      setShowPresetDropdown(false);
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

  const handleApplyProposal = (mode: "append" | "replace") => {
    const proposal = applyProposal.trim();
    if (!proposal) return;
    if (mode === "replace" && onReplaceContent) {
      onReplaceContent(proposal);
    } else {
      onInsertContent(proposal);
    }
    setApplyProposal("");
  };

  const handleApplyAgentPlan = () => {
    const preview = agentPreview.trim();
    if (!preview) return;
    if (onReplaceContent) {
      onReplaceContent(preview);
    } else {
      onInsertContent(preview);
    }
    setAgentPlan(null);
    setAgentPreview("");
    setAgentWarnings([]);
  };

  const startNewConversation = () => {
    resetDraftConversation();
    setShowConvDropdown(false);
  };

  const generateAutoTitle = async (firstUserMsg: string) => {
    if (!convIdRef.current) return;
    let title = firstUserMsg.trim();
    if (!title) title = firstUserMsg.trim();
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

  const busy = isStreaming || isPlanningEdit;

  // ── 主题相关样式 ──────────────────────────────────────────────────────────────
  const borderClass = theme === 'dark' ? 'border-slate-700/60' : theme === 'sepia' ? 'border-amber-200' : 'border-slate-100';
  const bgClass = theme === 'dark' ? 'bg-slate-900' : theme === 'sepia' ? 'bg-amber-50' : 'bg-white';
  const mutedClass = theme === 'dark' ? 'text-slate-500' : theme === 'sepia' ? 'text-amber-500' : 'text-slate-400';
  const textClass = theme === 'dark' ? 'text-slate-300' : theme === 'sepia' ? 'text-amber-700' : 'text-slate-700';
  const headingClass = theme === 'dark' ? 'text-slate-100' : theme === 'sepia' ? 'text-amber-900' : 'text-slate-800';
  const hoverBgClass = theme === 'dark' ? 'hover:bg-slate-800' : theme === 'sepia' ? 'hover:bg-amber-100' : 'hover:bg-slate-50';
  const inputBgClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-slate-500 focus:bg-slate-700' : theme === 'sepia' ? 'bg-amber-100/50 border-amber-200 text-amber-900 placeholder:text-amber-400 focus:border-amber-400 focus:bg-amber-50' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-300 focus:border-slate-400 focus:bg-white';
  const sendBtnClass = theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600' : theme === 'sepia' ? 'bg-amber-800 hover:bg-amber-700 disabled:bg-amber-200 disabled:text-amber-400' : 'bg-slate-900 hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-300';
  const dropdownBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : theme === 'sepia' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
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

  return (
    <div className={`flex flex-col h-full ${bgClass} border-l ${borderClass}`}>
      {/* 顶部栏 */}
      <header ref={topBarRef} className={`px-3 py-2 border-b ${borderClass} flex items-center gap-2 ${bgClass} shrink-0`}>
        {/* 对话选择器 */}
        <div className="relative flex-1 min-w-0">
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

          {/* 对话下拉列表 */}
          {showConvDropdown && (
            <div className={`absolute top-full left-0 right-0 mt-1 ${dropdownBg} border rounded-lg shadow-lg z-[500] overflow-hidden`}>
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
            </div>
          )}
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* 人格预设选择器 */}
          <div className="relative">
            <button
              onClick={() => setShowPresetDropdown(!showPresetDropdown)}
              className={`p-1.5 ${mutedClass} ${hoverBgClass} transition-colors rounded-lg flex items-center gap-0.5`}
              title="选择人格预设"
              type="button"
            >
              <User size={13} />
              {selectedPresetId && <span className={`text-[9px] font-bold px-1 rounded ${badgeClass}`}>✓</span>}
            </button>
            {showPresetDropdown && (
              <div className={`absolute top-full right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] ${dropdownBg} border rounded-lg shadow-lg z-[500] overflow-hidden`}>
                <div className={`px-3 py-2 border-b ${borderClass}`}>
                  <span className={`text-[9px] font-bold ${mutedClass} uppercase tracking-widest`}>人格预设</span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedPresetId(null); setShowPresetDropdown(false); }}
                    className={`w-full px-3 py-2.5 text-left ${dropdownItemHover} transition-colors ${selectedPresetId === null ? selectedDropdownBg : ''}`}
                    type="button"
                  >
                    <div className={`text-xs font-semibold ${headingClass}`}>默认人格</div>
                    <div className={`text-[10px] ${mutedClass} mt-0.5`}>使用系统内置写作助手人格</div>
                  </button>
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => { setSelectedPresetId(preset.id); setShowPresetDropdown(false); }}
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
              </div>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {agentSteps.length > 0 && (
          <section className={`overflow-hidden rounded-lg border ${borderClass} ${contextBarBg} ${isStreaming ? "sticky top-0 z-20 shadow-sm" : ""}`}>
            <button
              type="button"
              onClick={() => setAgentRunCollapsed((current) => !current)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left ${hoverBgClass}`}
            >
              <div className={`rounded-md p-1.5 ${badgeClass}`}>
                <Brain size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-semibold ${headingClass}`}>
                  {isStreaming ? "Agent 正在处理" : "Agent 执行记录"}
                </div>
                <div className={`mt-0.5 truncate text-[10px] ${mutedClass}`}>
                  {agentSteps.filter((step) => step.status === "completed").length} / {agentSteps.length} 步完成
                </div>
              </div>
              {agentRunCollapsed ? <ChevronDown size={13} className={mutedClass} /> : <ChevronUp size={13} className={mutedClass} />}
            </button>

            {!agentRunCollapsed && (
              <div className={`border-t px-3 py-2 ${borderClass}`}>
                {agentSteps.map((step, index) => {
                  const title = AGENT_LABELS[step.title] || step.title;
                  const statusIcon = step.status === "running"
                    ? <Loader2 size={13} className="animate-spin text-orange-500" />
                    : step.status === "failed"
                      ? <XCircle size={13} className="text-red-500" />
                      : <CheckCircle2 size={13} className="text-emerald-500" />;
                  return (
                    <div key={step.id} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                      {index < agentSteps.length - 1 && <div className={`absolute left-[6px] top-4 h-[calc(100%-0.5rem)] w-px ${theme === "dark" ? "bg-slate-700" : "bg-slate-200"}`} />}
                      <div className="relative z-10 mt-0.5 shrink-0">{statusIcon}</div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium ${headingClass}`}>{title}</div>
                        {step.detail && <div className={`mt-0.5 text-[10px] leading-4 ${mutedClass}`}>{step.detail}</div>}
                        {step.content && (
                          <details className="group mt-1">
                            <summary className={`flex cursor-pointer list-none items-center gap-1 text-[10px] font-medium ${mutedClass}`}>
                              <Search size={10} />
                              查看读取内容
                              <ChevronDown size={10} className="transition-transform group-open:rotate-180" />
                            </summary>
                            <pre className={`mt-1 max-h-44 overflow-auto whitespace-pre-wrap rounded-md border px-2 py-1.5 text-[10px] leading-4 ${borderClass} ${textClass}`}>{step.content}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {messages.length === 0 && (
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

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" ? (
              <div className={`max-w-[90%] ${userMsgBg} text-sm px-3 py-2 rounded-2xl rounded-tr-sm leading-relaxed`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[96%] space-y-1.5">
                <div className={`text-sm leading-relaxed ${textClass} ${msg.isStreaming ? "opacity-80" : ""}`}>
                  {msg.isStreaming && msg.content === "" ? (
                    <div className="flex space-x-1 py-1">
                      <span className={`w-1.5 h-1.5 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'} rounded-full animate-bounce`} style={{ animationDelay: "0ms" }} />
                      <span className={`w-1.5 h-1.5 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'} rounded-full animate-bounce`} style={{ animationDelay: "150ms" }} />
                      <span className={`w-1.5 h-1.5 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'} rounded-full animate-bounce`} style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}{msg.isStreaming && <span className={`inline-block w-0.5 h-3.5 ${theme === 'dark' ? 'bg-slate-400' : 'bg-slate-500'} ml-0.5 animate-caret align-middle`} />}</p>
                  )}
                </div>
                {!msg.isStreaming && msg.content && (
                  <button
                    onClick={() => {
                      setAgentPlan(null);
                      setAgentPreview("");
                      setAgentWarnings([]);
                      setApplyProposal(msg.content);
                    }}
                    className={`flex items-center space-x-1.5 text-[10px] font-bold ${mutedClass} ${hoverBgClass} px-2 py-1 rounded-lg transition-colors`}
                    type="button"
                  >
                    <ArrowLeftRight size={10} />
                    <span>写入预览</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
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
            onClick={() => handleAgentEdit()}
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
      <AgentApplyReview
        open={Boolean(applyProposal || agentPlan)}
        theme={theme}
        currentContent={getEditorContent()}
        proposal={agentPlan ? agentPreview : applyProposal}
        plan={agentPlan}
        warnings={agentWarnings}
        onCancel={() => {
          setApplyProposal("");
          setAgentPlan(null);
          setAgentPreview("");
          setAgentWarnings([]);
        }}
        onApply={handleApplyProposal}
        onApplyPlan={handleApplyAgentPlan}
      />
    </div>
  );
}
