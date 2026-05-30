"use client";

import React, { useState, useEffect } from "react";
import { Settings, SettingsUpdate, KnowledgeBase } from "@/types/api";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  ChevronLeft,
  Save,
  Cpu,
  Key,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  Hash,
  Sparkles,
  Palette,
  Database,
  Upload,
  Trash2,
  FileText,
  Loader2,
} from "lucide-react";
import PersonaManager from "@/components/persona-manager";
import { useTheme } from "@/hooks/use-theme";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [provider, setProvider] = useState<string>("deepseek");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [activeTab, setActiveTab] = useState<"model" | "persona" | "knowledge" | "appearance">("model");
  const [summaryAutoGenerate, setSummaryAutoGenerate] = useState(true);
  const [summaryGenerationStyle, setSummaryGenerationStyle] = useState("concise");
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const [workspaceDir, setWorkspaceDir] = useState("./workspace");
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState("");
  const [workspaceSyncing, setWorkspaceSyncing] = useState(false);

  // 分层记忆和RAG设置
  const [currentChapterChars, setCurrentChapterChars] = useState(4000);
  const [nearbyChapterCount, setNearbyChapterCount] = useState(3);
  const [injectNearbySummaries, setInjectNearbySummaries] = useState(true);
  const [injectChapterRag, setInjectChapterRag] = useState(true);
  const [suggestUseExternalRag, setSuggestUseExternalRag] = useState(false);
  const [chatUseChapterRag, setChatUseChapterRag] = useState(true);
  const [externalRagWeight, setExternalRagWeight] = useState(30);

  // 知识库状态
  const [kbItems, setKbItems] = useState<KnowledgeBase[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { loadSettings(); }, []);

  // 切换到知识库 Tab 时加载
  useEffect(() => {
    if (activeTab === "knowledge") loadKnowledgeBases();
  }, [activeTab]);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      setProvider(data.ai_provider || "deepseek");
      setTemperature(data.temperature ?? 0.7);
      setMaxTokens(data.max_tokens ?? 2000);
      setSummaryAutoGenerate(data.summary_auto_generate ?? true);
      setSummaryGenerationStyle(data.summary_generation_style || "concise");
      setAutoSaveInterval(data.auto_save_interval ?? 30);
      setWorkspaceDir(data.workspace_dir || "./workspace");
      // 分层记忆和RAG设置
      setCurrentChapterChars(data.current_chapter_chars ?? 4000);
      setNearbyChapterCount(data.nearby_chapter_count ?? 3);
      setInjectNearbySummaries(data.inject_nearby_summaries ?? true);
      setInjectChapterRag(data.inject_chapter_rag ?? true);
      setSuggestUseExternalRag(data.suggest_use_external_rag ?? false);
      setChatUseChapterRag(data.chat_use_chapter_rag ?? true);
      setExternalRagWeight(data.external_rag_weight ?? 30);
    } catch {}
    finally { setLoading(false); }
  };

  const loadKnowledgeBases = async () => {
    setKbLoading(true);
    setKbError(null);
    try {
      const data = await api.getKnowledgeBases();
      setKbItems(data);
    } catch { setKbError("无法获取知识库列表"); }
    finally { setKbLoading(false); }
  };

  const handleKbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKbUploading(true);
    setKbError(null);
    try {
      await api.uploadKnowledgeBase(file);
      await loadKnowledgeBases();
    } catch { setKbError("上传失败，请确保格式正确（txt/pdf/docx）"); }
    finally { setKbUploading(false); e.target.value = ""; }
  };

  const handleKbDelete = async (id: number) => {
    if (!confirm("确定要删除这个文档吗？")) return;
    try { await api.deleteKnowledgeBase(id); await loadKnowledgeBases(); }
    catch { setKbError("删除失败"); }
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const update: SettingsUpdate = {
        ai_provider: provider,
        temperature,
        max_tokens: maxTokens,
        summary_auto_generate: summaryAutoGenerate,
        summary_generation_style: summaryGenerationStyle,
        auto_save_interval: autoSaveInterval,
        workspace_dir: workspaceDir.trim() || "./workspace",
        // 分层记忆和RAG设置
        current_chapter_chars: currentChapterChars,
        nearby_chapter_count: nearbyChapterCount,
        inject_nearby_summaries: injectNearbySummaries,
        inject_chapter_rag: injectChapterRag,
        suggest_use_external_rag: suggestUseExternalRag,
        chat_use_chapter_rag: chatUseChapterRag,
        external_rag_weight: externalRagWeight,
      };
      if (apiKeyInput) {
        if (provider === "deepseek") update.deepseek_api_key = apiKeyInput;
        else if (provider === "openai") update.openai_api_key = apiKeyInput;
      }
      await api.updateSettings(update);
      setApiKeyInput("");
      await loadSettings();
      showToast("配置已保存", true);
      return true;
    } catch {
      showToast("保存失败，请重试", false);
      return false;
    }
    finally { setSaving(false); }
  };

  const handleWorkspaceSync = async () => {
    setWorkspaceSyncing(true);
    setWorkspaceSyncStatus("正在同步作品库...");
    try {
      const saved = await handleSave();
      if (!saved) {
        setWorkspaceSyncStatus("设置保存失败，未同步作品库");
        return;
      }
      const result = await api.syncWorkspaceLibrary();
      setWorkspaceSyncStatus(`已同步 ${result.book_count} 本书、${result.chapter_count} 章到 ${result.workspace}`);
    } catch {
      setWorkspaceSyncStatus("作品库同步失败");
    } finally {
      setWorkspaceSyncing(false);
    }
  };

  // ── 主题相关样式 ─────────────────────────────────────────────────────────────
  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';
  const pageBg = isDark ? 'bg-slate-950' : isSepia ? 'bg-amber-50' : 'bg-slate-50';
  const headerBg = isDark ? 'bg-slate-900/90 border-slate-800' : isSepia ? 'bg-amber-100/80 border-amber-200' : 'bg-white/90 border-slate-200';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : isSepia ? 'bg-amber-100/60 border-amber-200' : 'bg-white border-slate-100';
  const headingTxt = isDark ? 'text-slate-100' : isSepia ? 'text-amber-900' : 'text-slate-800';
  const bodyTxt = isDark ? 'text-slate-300' : isSepia ? 'text-amber-700' : 'text-slate-600';
  const mutedTxt = isDark ? 'text-slate-500' : isSepia ? 'text-amber-500' : 'text-slate-400';
  const borderCls = isDark ? 'border-slate-800' : isSepia ? 'border-amber-200' : 'border-slate-100';
  const accentBar = isDark ? 'bg-slate-400' : isSepia ? 'bg-amber-600' : 'bg-slate-900';
  const navActive = isDark ? 'bg-slate-800 text-slate-100' : isSepia ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-900';
  const navInactive = isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : isSepia ? 'text-amber-600 hover:bg-amber-100 hover:text-amber-900' : 'text-slate-500 hover:bg-slate-100';
  const inputCls = isDark ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-slate-500' : isSepia ? 'bg-amber-50 border-amber-300 text-amber-900 placeholder:text-amber-400 focus:border-amber-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-300 focus:border-slate-400';
  const primaryBtn = isDark ? 'bg-slate-700 hover:bg-slate-600 text-white shadow-slate-900' : isSepia ? 'bg-amber-800 hover:bg-amber-700 text-white shadow-amber-300' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200';
  const hoverRow = isDark ? 'hover:bg-slate-800' : isSepia ? 'hover:bg-amber-100' : 'hover:bg-slate-50';

  return (
    <div className={`min-h-screen ${pageBg} flex flex-col ${bodyTxt}`}>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center space-x-2 transition-all ${toast.ok ? "bg-slate-900 text-white" : "bg-red-500 text-white"}`}>
          <span>{toast.ok ? "✓" : "✕"}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 顶部导航 */}
      <header className={`sticky top-0 z-[100] backdrop-blur-md border-b ${headerBg} px-8 py-4 flex justify-between items-center`}>
        <div className="flex items-center space-x-6">
          <Link href="/" className={`group flex items-center space-x-2 ${mutedTxt} hover:${headingTxt} transition-all`}>
            <div className={`p-2 rounded-full ${hoverRow} transition-colors`}>
              <ChevronLeft size={20} />
            </div>
            <span className="text-sm font-medium">返回编辑器</span>
          </Link>
          <div className={`h-4 w-px ${borderCls}`} />
          <div className="flex items-center space-x-2">
            <SettingsIcon size={18} className={mutedTxt} />
            <h1 className={`font-bold text-lg tracking-tight ${headingTxt}`}>系统配置中心</h1>
          </div>
        </div>
        <button
          onClick={() => handleSave()}
          disabled={saving || activeTab !== 'model'}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-full ${primaryBtn} disabled:opacity-40 transition-all shadow-lg font-semibold text-sm`}
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
          <span>{saving ? "正在同步..." : "保存更改"}</span>
        </button>
      </header>

      <main className={`flex-1 max-w-5xl mx-auto w-full py-10 px-8 grid grid-cols-12 gap-10`}>
        {/* 左侧导航 */}
        <aside className="col-span-3 space-y-1">
          <nav className="sticky top-28">
            <p className={`text-[10px] font-bold ${mutedTxt} uppercase tracking-widest px-4 mb-3`}>配置分类</p>
            {[
              { key: "model", icon: <Cpu size={16} />, label: "AI 模型服务" },
              { key: "persona", icon: <Sparkles size={16} />, label: "人格预设" },
              { key: "knowledge", icon: <Database size={16} />, label: "知识库 (RAG)" },
              { key: "appearance", icon: <Palette size={16} />, label: "外观主题" },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === key ? navActive : navInactive}`}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* 右侧主配置区 */}
        <div className="col-span-9 space-y-8 pb-20">
          {loading && activeTab === 'model' ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className={`w-10 h-10 border-4 ${isDark ? 'border-slate-700 border-t-slate-400' : 'border-slate-200 border-t-slate-900'} rounded-full animate-spin`} />
              <p className={`text-sm ${mutedTxt} font-medium`}>正在读取配置...</p>
            </div>
          ) : (
            <>
              {/* ── AI 模型服务 ── */}
              {activeTab === "model" && (
                <>
                  {/* 供应商选择 */}
                  <section className="space-y-5">
                    <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                      <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                      <h2 className={`text-lg font-bold ${headingTxt}`}>模型供应商</h2>
                    </div>
                    <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-6`}>
                      <div className="space-y-3">
                        <label className={`text-sm font-bold ${headingTxt}`}>选择 AI 服务商</label>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className={`w-full border-2 rounded-2xl px-6 py-4 text-sm focus:ring-4 outline-none transition-all ${inputCls}`}
                        >
                          <option value="deepseek">DeepSeek - 极致性价比，中文创作首选</option>
                          <option value="openai">OpenAI - 行业标杆，逻辑性极强</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* API Key */}
                  <section className="space-y-5">
                    <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                      <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                      <h2 className={`text-lg font-bold ${headingTxt}`}>API 身份验证</h2>
                    </div>
                    <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-6`}>
                      <div className="flex items-start space-x-4">
                        <div className={`p-3 ${isDark ? 'bg-amber-900/30' : 'bg-amber-50'} rounded-2xl text-amber-500`}>
                          <Key size={24} />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="space-y-1">
                            <label className={`text-sm font-bold ${headingTxt}`}>
                              {provider === "deepseek" ? "DeepSeek API Key" : "OpenAI API Key"}
                            </label>
                            <p className={`text-xs ${mutedTxt}`}>密钥将经过 AES-256 加密后存储在本地。</p>
                          </div>
                          <div className="relative group">
                            <input
                              type="password"
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              placeholder={provider === "deepseek" ? (settings?.has_deepseek_key ? "•••••••••••••••• (已加密存储)" : "sk-...") : (settings?.has_openai_key ? "•••••••••••••••• (已加密存储)" : "sk-...")}
                              className={`w-full border-2 rounded-2xl px-6 py-4 text-sm focus:ring-4 outline-none transition-all font-mono ${inputCls}`}
                            />
                            {(provider === "deepseek" ? settings?.has_deepseek_key : settings?.has_openai_key) && !apiKeyInput && (
                              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center space-x-2 text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                <CheckCircle2 size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">密钥已就绪</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* 生成参数 */}
                  <section className="space-y-5">
                    <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                      <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                      <h2 className={`text-lg font-bold ${headingTxt}`}>生成参数控制</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-5`}>
                        <div className="flex justify-between items-center">
                          <div className={`flex items-center space-x-3 ${headingTxt} font-bold text-sm`}>
                            <Thermometer size={18} className="text-orange-500" />
                            <span>采样温度</span>
                          </div>
                          <span className={`${headingTxt} font-black text-sm px-2 py-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg`}>{temperature}</span>
                        </div>
                        <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-slate-700 accent-slate-400' : 'bg-slate-100 accent-slate-900'}`} />
                        <div className={`flex justify-between text-[10px] ${mutedTxt} font-bold uppercase tracking-widest`}><span>严谨精确</span><span>更具创意</span></div>
                      </div>
                      <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-5`}>
                        <div className="flex justify-between items-center">
                          <div className={`flex items-center space-x-3 ${headingTxt} font-bold text-sm`}>
                            <Hash size={18} className="text-emerald-500" />
                            <span>最大生成长度</span>
                          </div>
                          <span className={`${headingTxt} font-black text-sm px-2 py-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg`}>{maxTokens}</span>
                        </div>
                        <input type="range" min="100" max="4000" step="100" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-slate-700 accent-slate-400' : 'bg-slate-100 accent-slate-900'}`} />
                        <div className={`flex justify-between text-[10px] ${mutedTxt} font-bold uppercase tracking-widest`}><span>短建议</span><span>长篇大论</span></div>
                      </div>
                    </div>
                  </section>

                  {/* 章节总结设置 */}
                  <section className="space-y-5">
                    <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                      <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                      <h2 className={`text-lg font-bold ${headingTxt}`}>章节总结设置</h2>
                    </div>
                    <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-6`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-sm font-bold ${headingTxt}`}>自动生成摘要</div>
                          <div className={`text-xs ${mutedTxt} mt-0.5`}>保存章节时自动生成 AI 摘要，用于分层记忆上下文</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSummaryAutoGenerate(v => !v)}
                          className={`relative w-12 h-6 rounded-full transition-colors ${summaryAutoGenerate ? (isDark ? 'bg-slate-400' : 'bg-slate-900') : (isDark ? 'bg-slate-700' : 'bg-slate-200')}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${summaryAutoGenerate ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {summaryAutoGenerate && (
                        <div className="space-y-3">
                          <label className={`text-sm font-bold ${headingTxt}`}>摘要生成风格</label>
                          <select
                            value={summaryGenerationStyle}
                            onChange={(e) => setSummaryGenerationStyle(e.target.value)}
                            className={`w-full border-2 rounded-2xl px-6 py-4 text-sm focus:ring-4 outline-none transition-all ${inputCls}`}
                          >
                            <option value="concise">简洁 - 一两句话概括核心情节</option>
                            <option value="detailed">详细 - 完整记录人物、事件与转折</option>
                            <option value="extract_first">提取首段 - 直接使用章节开头作为摘要</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* 保存行为设置 */}
                  <section className="space-y-5">
                    <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                      <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                      <h2 className={`text-lg font-bold ${headingTxt}`}>保存与文件</h2>
                    </div>
                    <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-5`}>
                      <div>
                        <label className={`text-sm font-bold ${headingTxt}`}>自动保存间隔（秒）</label>
                        <p className={`text-xs ${mutedTxt} mt-0.5 mb-3`}>编辑器停止输入后多少秒自动保存，设为 0 则禁用自动保存</p>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={autoSaveInterval}
                          onChange={(e) => setAutoSaveInterval(parseInt(e.target.value) || 0)}
                          className={`w-40 border-2 rounded-2xl px-6 py-4 text-sm focus:ring-4 outline-none transition-all ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className={`text-sm font-bold ${headingTxt}`}>作品文件夹</label>
                        <p className={`text-xs ${mutedTxt} mt-0.5 mb-3`}>章节 TXT、项目清单和导出文件默认同步到这里；可以填 D 盘或移动硬盘路径。</p>
                        <input
                          type="text"
                          value={workspaceDir}
                          onChange={(e) => setWorkspaceDir(e.target.value)}
                          placeholder="D:\\Novels\\VibeWriter"
                          className={`w-full border-2 rounded-2xl px-6 py-4 text-sm focus:ring-4 outline-none transition-all font-mono ${inputCls}`}
                        />
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            type="button"
                            onClick={handleWorkspaceSync}
                            disabled={workspaceSyncing}
                            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all disabled:opacity-50 ${primaryBtn}`}
                          >
                            {workspaceSyncing ? "同步中..." : "同步整个作品库"}
                          </button>
                          {workspaceSyncStatus && (
                            <span className={`text-[10px] ${mutedTxt} truncate`}>{workspaceSyncStatus}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* 分层记忆强度 */}
                  <section className="space-y-5">
                    <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                      <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                      <h2 className={`text-lg font-bold ${headingTxt}`}>分层记忆强度</h2>
                    </div>
                    <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-6`}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className={`text-sm font-bold ${headingTxt}`}>当前章节注入长度</label>
                          <span className={`text-sm font-mono ${mutedTxt}`}>{currentChapterChars} 字符</span>
                        </div>
                        <p className={`text-xs ${mutedTxt}`}>续写时注入当前章节的最大字符数</p>
                        <input
                          type="range" min={500} max={8000} step={500}
                          value={currentChapterChars}
                          onChange={e => setCurrentChapterChars(parseInt(e.target.value))}
                          className="w-full accent-slate-900"
                        />
                        <div className={`flex justify-between text-[10px] ${mutedTxt}`}>
                          <span>500</span><span>8000</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className={`text-sm font-bold ${headingTxt}`}>附近章节数量</label>
                          <span className={`text-sm font-mono ${mutedTxt}`}>{nearbyChapterCount} 章</span>
                        </div>
                        <p className={`text-xs ${mutedTxt}`}>注入当前章节前后各多少章的摘要</p>
                        <input
                          type="range" min={1} max={5} step={1}
                          value={nearbyChapterCount}
                          onChange={e => setNearbyChapterCount(parseInt(e.target.value))}
                          className="w-full accent-slate-900"
                        />
                        <div className={`flex justify-between text-[10px] ${mutedTxt}`}>
                          <span>1</span><span>5</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-bold ${headingTxt}`}>注入附近章节摘要</p>
                          <p className={`text-xs ${mutedTxt} mt-0.5`}>将附近章节的摘要注入 AI 上下文</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInjectNearbySummaries(v => !v)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${injectNearbySummaries ? 'bg-slate-900' : isDark ? 'bg-slate-700' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${injectNearbySummaries ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-bold ${headingTxt}`}>注入全书检索结果</p>
                          <p className={`text-xs ${mutedTxt} mt-0.5`}>从全书章节中检索相关内容注入上下文</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInjectChapterRag(v => !v)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${injectChapterRag ? 'bg-slate-900' : isDark ? 'bg-slate-700' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${injectChapterRag ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* RAG 行为 */}
                  <section className="space-y-5">
                    <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                      <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                      <h2 className={`text-lg font-bold ${headingTxt}`}>RAG 行为</h2>
                    </div>
                    <div className={`p-8 rounded-3xl shadow-sm border ${cardBg} space-y-6`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-bold ${headingTxt}`}>续写时默认使用外部知识库</p>
                          <p className={`text-xs ${mutedTxt} mt-0.5`}>关闭可防止 AI 直接复制上传的文档内容</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSuggestUseExternalRag(v => !v)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${suggestUseExternalRag ? 'bg-slate-900' : isDark ? 'bg-slate-700' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${suggestUseExternalRag ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-bold ${headingTxt}`}>对话中自动检索全书</p>
                          <p className={`text-xs ${mutedTxt} mt-0.5`}>对话时自动从全书章节中检索相关内容</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChatUseChapterRag(v => !v)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${chatUseChapterRag ? 'bg-slate-900' : isDark ? 'bg-slate-700' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${chatUseChapterRag ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className={`text-sm font-bold ${headingTxt}`}>外部知识库权重</label>
                          <span className={`text-sm font-mono ${mutedTxt}`}>{externalRagWeight}</span>
                        </div>
                        <p className={`text-xs ${mutedTxt}`}>值越高，AI 越倾向于参考外部文档风格</p>
                        <input
                          type="range" min={0} max={100} step={5}
                          value={externalRagWeight}
                          onChange={e => setExternalRagWeight(parseInt(e.target.value))}
                          className="w-full accent-slate-900"
                        />
                        <div className={`flex justify-between text-[10px] ${mutedTxt}`}>
                          <span>0（忽略）</span><span>100（强参考）</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* 隐私声明 */}
                  <div className={`${isDark ? 'bg-slate-800' : 'bg-slate-900'} rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl`}>
                    <div className="relative z-10 flex items-center space-x-6">
                      <div className="p-4 bg-white/10 backdrop-blur-xl rounded-2xl"><AlertCircle size={32} /></div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">隐私承诺</h3>
                        <p className="text-slate-200 text-sm leading-relaxed">VibeWriter 是&quot;本地优先&quot;的 IDE。除向您选择的 AI 服务商发送必要的提示词外，所有写作内容均仅存储在本地。</p>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                  </div>
                </>
              )}

              {/* ── 人格预设 ── */}
              {activeTab === "persona" && <PersonaManager />}

              {/* ── 知识库 ── */}
              {activeTab === "knowledge" && (
                <section className="space-y-6">
                  <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                    <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                    <h2 className={`text-lg font-bold ${headingTxt}`}>知识库 (RAG)</h2>
                  </div>

                  {kbError && (
                    <div className={`p-4 ${isDark ? 'bg-red-900/30 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} border rounded-2xl flex items-center space-x-3 text-sm`}>
                      <AlertCircle size={16} />
                      <span>{kbError}</span>
                    </div>
                  )}

                  {/* 上传区 */}
                  <div className={`p-8 rounded-3xl border ${cardBg} shadow-sm`}>
                    <label className="relative group cursor-pointer block">
                      <input type="file" className="hidden" onChange={handleKbUpload} disabled={kbUploading} accept=".txt,.pdf,.docx" />
                      <div className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all ${
                        kbUploading
                          ? `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`
                          : `${isDark ? 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`
                      }`}>
                        {kbUploading ? (
                          <Loader2 size={32} className={`${isDark ? 'text-slate-400' : 'text-slate-600'} animate-spin mb-4`} />
                        ) : (
                          <Upload size={32} className={`${mutedTxt} group-hover:${headingTxt} transition-colors mb-4`} />
                        )}
                        <span className={`text-sm font-bold ${headingTxt}`}>
                          {kbUploading ? "正在解析并向量化..." : "点击或拖拽上传写作语料"}
                        </span>
                        <span className={`text-[10px] ${mutedTxt} mt-2`}>支持 TXT, PDF, DOCX · 自动切片存储</span>
                      </div>
                    </label>
                  </div>

                  {/* 已上传列表 */}
                  <div className={`p-6 rounded-3xl border ${cardBg} shadow-sm space-y-4`}>
                    <h3 className={`text-xs font-bold ${mutedTxt} uppercase tracking-widest`}>已加载的知识片段</h3>
                    {kbLoading ? (
                      <div className="py-10 flex justify-center"><Loader2 className={`animate-spin ${mutedTxt}`} size={28} /></div>
                    ) : kbItems.length === 0 ? (
                      <div className={`py-10 text-center ${mutedTxt} italic text-sm border-2 border-dotted ${isDark ? 'border-slate-800' : 'border-slate-100'} rounded-2xl`}>
                        暂无知识语料，上传文件以开启 RAG 增强
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {kbItems.map((item) => (
                          <div key={item.id} className={`group p-4 rounded-2xl border ${borderCls} flex justify-between items-center ${hoverRow} transition-all`}>
                            <div className="flex items-center space-x-4">
                              <div className={`p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'} rounded-xl ${mutedTxt}`}>
                                <FileText size={18} />
                              </div>
                              <div>
                                <div className={`text-sm font-bold ${headingTxt} truncate max-w-[320px]`}>{item.title}</div>
                                <div className={`text-[10px] ${mutedTxt} font-medium mt-0.5`}>
                                  {item.chunk_count} 个知识切片 · {item.created_at ? new Date(item.created_at).toLocaleDateString() : '刚刚'}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleKbDelete(item.id)}
                              className={`p-2 ${mutedTxt} hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100`}
                              title="删除文档"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-blue-50 border-blue-100'} border rounded-2xl p-5`}>
                    <div className="flex items-start space-x-3">
                      <AlertCircle size={18} className={isDark ? 'text-slate-400' : 'text-blue-500'} />
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-blue-700'} leading-relaxed`}>
                        知识库通过 RAG (检索增强生成) 技术工作。续写时，AI 助手面板中的 RAG 开关开启后，系统会自动检索最相关的片段注入 AI 上下文，帮助 AI 学习您的措辞、人设或世界观。
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* ── 外观主题 ── */}
              {activeTab === "appearance" && (
                <section className="space-y-6">
                  <div className={`flex items-center space-x-2 border-b ${borderCls} pb-4`}>
                    <div className={`w-1.5 h-6 ${accentBar} rounded-full`} />
                    <h2 className={`text-lg font-bold ${headingTxt}`}>编辑器主题</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: "light", label: "浅色模式", desc: "经典白色背景，清晰简洁", preview: "from-white to-slate-50", previewBorder: "border-slate-200", ring: "border-slate-900 bg-white shadow-xl ring-4 ring-slate-100", normal: "border-slate-200 bg-white hover:border-slate-300" },
                      { key: "dark", label: "深色模式", desc: "护眼深色，适合夜间写作", preview: "from-slate-800 to-slate-900", previewBorder: "border-slate-700", ring: "border-slate-500 bg-slate-800 shadow-xl ring-4 ring-slate-700", normal: "border-slate-200 bg-white hover:border-slate-300" },
                      { key: "sepia", label: "护眼模式", desc: "米黄色背景，长时间阅读舒适", preview: "from-amber-100 to-amber-200", previewBorder: "border-amber-300", ring: "border-amber-800 bg-amber-100 shadow-xl ring-4 ring-amber-200", normal: "border-slate-200 bg-white hover:border-slate-300" },
                    ].map(t => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTheme(t.key as "light" | "dark" | "sepia")}
                        className={`relative p-6 rounded-2xl border-2 text-left transition-all ${theme === t.key ? t.ring : t.normal}`}
                      >
                        <div className={`aspect-video bg-gradient-to-br ${t.preview} border ${t.previewBorder} rounded-lg mb-4`} />
                        <div className="font-bold text-slate-900">{t.label}</div>
                        <div className="text-xs text-slate-400 mt-1">{t.desc}</div>
                        {theme === t.key && (
                          <div className="absolute top-3 right-3 bg-slate-900 text-white p-1 rounded-full"><CheckCircle2 size={14} /></div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-100'} border rounded-2xl p-5`}>
                    <div className="flex items-start space-x-3">
                      <AlertCircle size={18} className={isDark ? 'text-slate-400' : 'text-blue-500'} />
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-blue-700'} leading-relaxed`}>
                        主题设置会立即应用到整个应用界面，您的偏好会自动保存在浏览器本地存储中。
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
