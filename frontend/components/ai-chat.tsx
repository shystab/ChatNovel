"use client";

import React, { useState, useRef, useEffect } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import { Send, ArrowLeftRight, Sparkles, RotateCcw, ChevronDown, User, PanelRightClose, Library, Trash2 } from "lucide-react";
import type { Theme, ThemeColors } from "@/hooks/use-theme";
import { Chapter, Conversation } from "@/types/api";
import DocumentSelector from "@/components/document-selector";

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
  getEditorContent: () => string;
  theme: Theme;
  colors: ThemeColors;
  onToggleRight?: () => void;
  bookId?: number | null;
  chapters?: Chapter[];
  currentChapterId?: number | null;
}

const COMMANDS = [
  { cmd: "/续写", label: "续写当前情节", icon: "✦" },
  { cmd: "/改写", label: "润色选中文本", icon: "✧" },
  { cmd: "/检查", label: "检查语法错误", icon: "✓" },
  { cmd: "/情节", label: "提供情节建议", icon: "◈" },
];

const CONV_ID_KEY = "ai-conversation-id";

export default function AIChat({ onInsertContent, getEditorContent, theme, colors: _colors, onToggleRight, bookId, chapters: _chapters = [], currentChapterId = null }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [isLoading] = useState(false);
  const [useRag] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isStreaming, connect } = useWebSocket();
  const streamBufferRef = useRef("");
  const isFirstExchangeRef = useRef(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // ── 对话持久化（后端） ────────────────────────────
  const convIdRef = useRef<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationTitle, setConversationTitle] = useState("新对话");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showConvDropdown, setShowConvDropdown] = useState(false);

  // ── 文档选择 ──────────────────────────────────
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);

  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  // 启动时：从后端恢复对话
  useEffect(() => {
    async function initConversation() {
      // 尝试读取上次的对话 ID
      const storedId = localStorage.getItem(CONV_ID_KEY);
      if (storedId) {
        try {
          const conv = await api.getConversation(parseInt(storedId, 10));
          if (conv && conv.messages?.length > 0) {
            setMessages(conv.messages as Message[]);
            convIdRef.current = conv.id;
            setConversationTitle(conv.title || "新对话");
            setSelectedDocIds(conv.selected_doc_ids ?? []);
            await loadConversations();
            return;
          }
        } catch {
          // 对话不存在，创建新的
        }
      }
      // 创建新对话
      try {
        const conv = await api.createConversation({ title: "新对话", user_id: "default_user" });
        convIdRef.current = conv.id;
        setConversationTitle(conv.title || "新对话");
        localStorage.setItem(CONV_ID_KEY, String(conv.id));
        await loadConversations();
      } catch {
        // 后端不可用时降级到 localStorage
        const saved = localStorage.getItem("ai-chat-messages");
        if (saved) { try { setMessages(JSON.parse(saved)); } catch {} }
      }
    }
    void initConversation();
  }, []);

  const loadConversations = async () => {
    try {
      const list = await api.listConversations();
      setConversations(Array.isArray(list) ? list : (list as any).items ?? []);
    } catch {}
  };

  const switchConversation = async (conv: Conversation) => {
    setShowConvDropdown(false);
    try {
      const full = await api.getConversation(conv.id);
      const msgs = (full.messages ?? []) as Message[];
      setMessages(msgs);
      convIdRef.current = full.id;
      setConversationTitle(full.title || "新对话");
      setSelectedDocIds(full.selected_doc_ids ?? []);
      localStorage.setItem(CONV_ID_KEY, String(full.id));
      // 已有消息则不再自动生成标题
      isFirstExchangeRef.current = msgs.length === 0;
    } catch {}
  };

  const renameCurrentConversation = async (newTitle: string) => {
    setIsEditingTitle(false);
    if (!newTitle.trim() || !convIdRef.current) return;
    setConversationTitle(newTitle);
    try {
      await api.updateConversation(convIdRef.current, { title: newTitle });
      setConversations(prev => prev.map(c => c.id === convIdRef.current ? { ...c, title: newTitle } : c));
    } catch {}
  };

  // 保存对话到后端（fire-and-forget）
  const persistMessages = (msgs: Message[]) => {
    if (convIdRef.current) {
      api.updateConversation(convIdRef.current, {
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
      }).catch(() => {
        // 降级到 localStorage
        localStorage.setItem("ai-chat-messages", JSON.stringify(msgs));
      });
    } else {
      localStorage.setItem("ai-chat-messages", JSON.stringify(msgs));
    }
  };

  useEffect(() => { loadPresets(); }, []);

  const loadPresets = async () => {
    try {
      const res = await fetch(`${BASE}/presets/`);
      const data: PresetListResponse = await res.json();
      setPresets(data.items);
      const enabled = data.items.find(p => p.is_enabled);
      if (enabled) setSelectedPresetId(enabled.id);
    } catch {}
  };

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


  const startStream = (request: Parameters<typeof connect>[0]) => {
    streamBufferRef.current = "";
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
    const task = request.task || "chat";

    connect(withExtras, {
      onToken: (token) => {
        streamBufferRef.current += token;
        updateLastAiMessage(streamBufferRef.current, true);
      },
      onDone: () => {
        let finalContent = streamBufferRef.current;

        // 根据任务类型处理响应
        if (task === "check") {
          try {
            // 尝试解析JSON
            const jsonStart = finalContent.indexOf('{');
            const jsonEnd = finalContent.lastIndexOf('}') + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = finalContent.substring(jsonStart, jsonEnd);
              const result = JSON.parse(jsonStr);
              const issues = result.issues || [];
              const suggestions = result.suggestions || [];
              finalContent = issues.length > 0
                ? `已检查 ${currentEditorContent.length} 字，发现 ${issues.length} 处问题：\n\n${issues.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}\n\n建议：\n${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`
                : `✓ 已检查 ${currentEditorContent.length} 字，未发现明显语法问题，文章表达流畅。`;
            }
          } catch (e) {
            // 解析失败，使用原始内容
            console.error("Failed to parse check response:", e);
          }
        } else if (task === "plot") {
          try {
            // 尝试解析JSON
            const jsonStart = finalContent.indexOf('{');
            const jsonEnd = finalContent.lastIndexOf('}') + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = finalContent.substring(jsonStart, jsonEnd);
              const result = JSON.parse(jsonStr);
              const suggestions = result.suggestions || [];
              const contextInfo = currentEditorContent.length > 0
                ? `基于当前内容（${currentEditorContent.length} 字），为你生成以下情节方向：\n\n`
                : `以下是几个情节方向：\n\n`;
              finalContent = contextInfo + suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n\n');
            }
          } catch (e) {
            console.error("Failed to parse plot response:", e);
          }
        }

        updateLastAiMessage(finalContent, false);

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
      onError: (message) => { updateLastAiMessage(`出错了：${message}`, false); },
    });
  };

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim();
    
    if (!trimmed || isStreaming || isLoading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setShowCommands(false);

    const editorContent = getEditorContent();

    if (trimmed.startsWith("/续写")) {
      startStream({
        task: "suggest",
        type: "suggest", // 向后兼容
        content: editorContent,
        max_length: 300,
        use_rag: useRag,
        use_memory: true,
        use_layered_memory: true,
        use_external_rag: false, // 续写默认不启用外部RAG
        use_chapter_rag: true, // 续写默认启用全书检索
        external_rag_weight: 30
      });
    } else if (trimmed.startsWith("/改写")) {
      if (!editorContent?.trim()) {
        setMessages(prev => {
          const next = [...prev, { role: "ai" as const, content: "编辑器中没有内容可以改写。请先在编辑器中输入一些文字。", isStreaming: false }];
          persistMessages(next);
          return next;
        });
        return;
      }
      startStream({
        task: "rewrite",
        type: "chat", // 使用chat类型保持兼容
        content: editorContent,
        max_length: editorContent.length * 2, // 改写可能变长
        use_memory: true,
        use_layered_memory: true,
        use_external_rag: false, // 改写通常不需要外部RAG
        use_chapter_rag: true, // 但可能需要全书上下文保持风格一致
        external_rag_weight: 30
      });
    } else if (trimmed.startsWith("/检查")) {
      if (!editorContent?.trim()) {
        setMessages(prev => {
          const next = [...prev, { role: "ai" as const, content: "编辑器中没有内容可以检查。", isStreaming: false }];
          persistMessages(next);
          return next;
        });
        return;
      }
      startStream({
        task: "check",
        type: "chat",
        content: editorContent,
        max_length: 1000,
        use_memory: true,
        use_layered_memory: true,
        use_external_rag: false,
        use_chapter_rag: false, // 检查不需要章节上下文
        external_rag_weight: 30
      });
    } else if (trimmed.startsWith("/情节")) {
      // 提取关键词
      const keywords = editorContent.length > 0
        ? editorContent.split(/[，。！？\s]+/).filter(w => w.length >= 2).slice(0, 5)
        : [];
      const keywordText = keywords.length > 0 ? `关键词：${keywords.join('、')}` : "";
      void keywordText;
      startStream({
        task: "plot",
        type: "chat",
        content: editorContent,
        max_length: 800,
        use_memory: true,
        use_layered_memory: true,
        use_external_rag: false,
        use_chapter_rag: true, // 情节建议可能需要全书上下文
        external_rag_weight: 30
      });
    } else {
      const historyMessages = messages.map(m => ({ role: m.role === "ai" ? "assistant" : m.role, content: m.content }));
      historyMessages.push({ role: "user", content: trimmed });
      startStream({
        task: "chat",
        type: "chat",
        messages: historyMessages,
        max_length: 500,
        use_memory: true,
        use_layered_memory: false, // 普通对话默认不启用分层记忆
        use_external_rag: false, // 默认不启用外部RAG
        use_chapter_rag: true, // 默认启用全书检索
        external_rag_weight: 30
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") setShowCommands(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowCommands(val === "/" || (val.startsWith("/") && !val.includes(" ")));
  };

  const clearMessages = async () => {
    setMessages([]);
    localStorage.removeItem("ai-chat-messages");
    isFirstExchangeRef.current = true;
    // 创建新对话替换当前
    try {
      const conv = await api.createConversation({ title: "新对话", user_id: "default_user" });
      convIdRef.current = conv.id;
      setConversationTitle(conv.title || "新对话");
      localStorage.setItem(CONV_ID_KEY, String(conv.id));
      await loadConversations();
    } catch {}
  };

  const generateAutoTitle = async (firstUserMsg: string) => {
    if (!convIdRef.current) return;
    // 去掉指令前缀（/续写、/改写 等）
    let title = firstUserMsg.replace(/^\/[^\s]+\s*/, "").trim();
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
    try {
      await api.deleteConversation(conv.id);
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      // 如果删除的是当前对话，创建新对话
      if (conv.id === convIdRef.current) {
        await clearMessages();
      }
    } catch {}
  };

  const busy = isStreaming || isLoading;

  // ── 主题相关样式 ──────────────────────────────────────────────────────────────
  const borderClass = theme === 'dark' ? 'border-slate-700/60' : theme === 'sepia' ? 'border-amber-200' : 'border-slate-100';
  const bgClass = theme === 'dark' ? 'bg-slate-900' : theme === 'sepia' ? 'bg-amber-50' : 'bg-white';
  const mutedClass = theme === 'dark' ? 'text-slate-500' : theme === 'sepia' ? 'text-amber-500' : 'text-slate-400';
  const textClass = theme === 'dark' ? 'text-slate-300' : theme === 'sepia' ? 'text-amber-700' : 'text-slate-700';
  const headingClass = theme === 'dark' ? 'text-slate-100' : theme === 'sepia' ? 'text-amber-900' : 'text-slate-800';
  const hoverBgClass = theme === 'dark' ? 'hover:bg-slate-800' : theme === 'sepia' ? 'hover:bg-amber-100' : 'hover:bg-slate-50';
  const inputBgClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-slate-500 focus:bg-slate-750' : theme === 'sepia' ? 'bg-amber-100/50 border-amber-200 text-amber-900 placeholder:text-amber-400 focus:border-amber-400 focus:bg-amber-50' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-300 focus:border-slate-400 focus:bg-white';
  const sendBtnClass = theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600' : theme === 'sepia' ? 'bg-amber-800 hover:bg-amber-700 disabled:bg-amber-200 disabled:text-amber-400' : 'bg-slate-900 hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-300';
  const dropdownBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : theme === 'sepia' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
  const dropdownItemHover = theme === 'dark' ? 'hover:bg-slate-700' : theme === 'sepia' ? 'hover:bg-amber-100' : 'hover:bg-slate-50';
  const userMsgBg = theme === 'dark' ? 'bg-slate-700 text-slate-100' : theme === 'sepia' ? 'bg-amber-800 text-white' : 'bg-slate-900 text-white';
  const inputAreaBg = theme === 'dark' ? 'bg-slate-900 border-slate-700/60' : theme === 'sepia' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100';

  return (
    <div className={`flex flex-col h-full ${bgClass} border-l ${borderClass}`}>
      {/* 顶部栏 */}
      <header className={`px-3 py-2 border-b ${borderClass} flex items-center gap-2 ${bgClass} shrink-0`}>
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
            <div className={`absolute top-full left-0 mt-1 w-64 ${dropdownBg} border rounded-xl shadow-xl z-[500] overflow-hidden`}>
              <div className={`px-3 py-2 border-b ${borderClass} flex items-center justify-between`}>
                <span className={`text-[9px] font-bold ${mutedClass} uppercase tracking-widest`}>对话列表</span>
                <button
                  onClick={async () => { setShowConvDropdown(false); await clearMessages(); }}
                  className={`text-[9px] ${mutedClass} ${hoverBgClass} px-2 py-0.5 rounded-lg transition-colors`}
                  type="button"
                >
                  + 新对话
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
                      className={`w-full px-3 py-2.5 pr-8 text-left ${dropdownItemHover} transition-colors ${conv.id === convIdRef.current ? (theme === 'dark' ? 'bg-slate-700' : 'bg-blue-50') : ''}`}
                      type="button"
                    >
                      <div className={`text-xs font-semibold truncate ${headingClass}`}>{conv.title || "新对话"}</div>
                      <div className={`text-[9px] ${mutedClass} mt-0.5`}>{new Date(conv.update_time).toLocaleDateString("zh-CN")}</div>
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
              <div className={`px-3 py-2 border-t ${borderClass}`}>
                <button
                  onClick={() => {
                    const firstUser = messages.find(m => m.role === "user");
                    if (firstUser) { setShowConvDropdown(false); generateAutoTitle(firstUser.content); }
                  }}
                  disabled={!messages.some(m => m.role === "user")}
                  className={`w-full text-[10px] ${mutedClass} hover:${mutedClass} py-1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
                  type="button"
                  title="根据对话内容自动生成标题"
                >
                  ✦ AI 自动生成名称
                </button>
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
              className={`p-1.5 ${mutedClass} ${hoverBgClass} transition-colors rounded-lg flex items-center space-x-0.5`}
              title="选择人格预设"
              type="button"
            >
              <User size={13} />
              {selectedPresetId && <span className="text-[9px] font-bold text-purple-500">✓</span>}
            </button>
            {showPresetDropdown && (
              <div className={`absolute top-full right-0 mt-1 w-52 ${dropdownBg} border rounded-xl shadow-xl z-[500] overflow-hidden`}>
                <div className={`px-3 py-2 border-b ${borderClass}`}>
                  <span className={`text-[9px] font-bold ${mutedClass} uppercase tracking-widest`}>人格预设</span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedPresetId(null); setShowPresetDropdown(false); }}
                    className={`w-full px-3 py-2.5 text-left ${dropdownItemHover} transition-colors ${selectedPresetId === null ? (theme === 'dark' ? 'bg-slate-700' : 'bg-purple-50') : ''}`}
                    type="button"
                  >
                    <div className={`text-xs font-bold ${headingClass}`}>默认人格</div>
                    <div className={`text-[10px] ${mutedClass} mt-0.5`}>使用系统内置写作助手人格</div>
                  </button>
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => { setSelectedPresetId(preset.id); setShowPresetDropdown(false); }}
                      className={`w-full px-3 py-2.5 text-left ${dropdownItemHover} transition-colors ${selectedPresetId === preset.id ? (theme === 'dark' ? 'bg-slate-700' : 'bg-purple-50') : ''}`}
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <div className={`text-xs font-bold ${headingClass}`}>{preset.name}</div>
                        {preset.is_enabled && <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full font-bold">启用</span>}
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
            onClick={() => setShowDocSelector(true)}
            className={`p-1.5 ${mutedClass} ${hoverBgClass} transition-colors rounded-lg flex items-center space-x-0.5`}
            title="选择参考文档"
            type="button"
          >
            <Library size={13} />
            {selectedDocIds.length > 0 && <span className="text-[9px] font-bold text-blue-500">{selectedDocIds.length}</span>}
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className={`p-1.5 ${mutedClass} ${hoverBgClass} transition-colors rounded-lg`}
              title="清空对话"
              type="button"
            >
              <RotateCcw size={13} />
            </button>
          )}

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

      <DocumentSelector
        conversationId={convIdRef.current}
        isOpen={showDocSelector}
        onClose={() => setShowDocSelector(false)}
        initialSelectedIds={selectedDocIds}
        onSave={(ids) => setSelectedDocIds(ids)}
        theme={theme}
      />

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center space-y-4 py-8">
            <div className={`w-9 h-9 rounded-2xl ${theme === 'dark' ? 'bg-slate-800' : theme === 'sepia' ? 'bg-amber-100' : 'bg-slate-50'} flex items-center justify-center`}>
              <Sparkles size={16} className={mutedClass} />
            </div>
            <div className="text-center space-y-1">
              <p className={`text-xs font-semibold ${textClass}`}>AI 写作助手</p>
              <p className={`text-[10px] ${mutedClass}`}>输入 / 触发写作指令</p>
            </div>
            <div className="w-full space-y-1">
              {COMMANDS.map(c => (
                <button
                  key={c.cmd}
                  onClick={() => { setInput(c.cmd + " "); textareaRef.current?.focus(); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl ${hoverBgClass} transition-colors text-left group`}
                  type="button"
                >
                  <span className={`${mutedClass} text-sm w-4 text-center`}>{c.icon}</span>
                  <span className={`text-[10px] font-bold ${mutedClass} font-mono`}>{c.cmd}</span>
                  <span className={`text-[10px] ${mutedClass} opacity-70`}>{c.label}</span>
                </button>
              ))}
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
                    onClick={() => onInsertContent(msg.content)}
                    className={`flex items-center space-x-1.5 text-[10px] font-bold ${mutedClass} ${hoverBgClass} px-2 py-1 rounded-lg transition-colors`}
                    type="button"
                  >
                    <ArrowLeftRight size={10} />
                    <span>插入编辑器</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className={`p-2.5 border-t ${inputAreaBg} relative shrink-0`}>
        {/* 指令面板 */}
        {showCommands && (
          <div className={`absolute bottom-full left-2.5 right-2.5 ${dropdownBg} border rounded-2xl shadow-xl mb-2 overflow-hidden`}>
            <div className={`px-3 py-2 border-b ${borderClass}`}>
              <span className={`text-[9px] font-bold ${mutedClass} uppercase tracking-widest`}>写作指令</span>
            </div>
            {COMMANDS.map(c => (
              <button
                key={c.cmd}
                onClick={() => { setInput(c.cmd + " "); setShowCommands(false); textareaRef.current?.focus(); }}
                className={`w-full px-4 py-2.5 text-left ${dropdownItemHover} flex items-center space-x-3 transition-colors`}
                type="button"
              >
                <span className={`${mutedClass} text-sm w-4 text-center`}>{c.icon}</span>
                <span className={`text-xs font-bold ${headingClass} font-mono`}>{c.cmd}</span>
                <span className={`text-xs ${mutedClass}`}>{c.label}</span>
              </button>
            ))}
            <div className={`px-3 py-2 border-t ${borderClass} flex items-center justify-between`}>
              <span className={`text-[9px] ${mutedClass}`}>或直接输入问题与 AI 对话</span>
              <ChevronDown size={10} className={mutedClass} />
            </div>
          </div>
        )}

        <div className="flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={busy ? "AI 正在思考…" : "输入消息或 / 触发指令"}
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
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
