"use client";

import React, { useState, useEffect, useRef } from "react";
import { Chapter } from "@/types/api";
import { api } from "@/lib/api";
import { Download, Plus, Settings, Trash2, Pencil, Check, X, PanelLeftClose, FileText } from "lucide-react";
import type { Theme, ThemeColors } from "@/hooks/use-theme";

interface ChapterListProps {
  bookId: number | null;
  chapters: Chapter[];
  onChaptersChange: (chapters: Chapter[]) => void;
  onChapterSelect: (id: number) => void;
  selectedChapterId: number | null;
  theme: Theme;
  colors: ThemeColors;
  onToggleLeft: () => void;
}

// ── 导出弹窗 ──────────────────────────────────────────────────────────────────
interface ExportModalProps {
  chapters: Chapter[];
  onClose: () => void;
  theme: Theme;
}

function ExportModal({ chapters, onClose, theme }: ExportModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set(chapters.map(c => c.id)));
  const [fmt, setFmt] = useState<"txt" | "docx">("txt");

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => prev.size === chapters.length ? new Set() : new Set(chapters.map(c => c.id)));
  };

  const handleExport = () => {
    const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const ids = Array.from(selected).join(",");
    if (!ids) return;
    window.location.href = `${BASE}/chapters/export/${fmt}?ids=${ids}`;
    onClose();
  };

  const bg = theme === 'dark' ? 'bg-slate-900' : theme === 'sepia' ? 'bg-amber-50' : 'bg-white';
  const headerBg = theme === 'dark' ? 'bg-slate-800' : theme === 'sepia' ? 'bg-amber-100/60' : 'bg-slate-50';
  const border = theme === 'dark' ? 'border-slate-700' : theme === 'sepia' ? 'border-amber-200' : 'border-slate-200';
  const text = theme === 'dark' ? 'text-slate-200' : theme === 'sepia' ? 'text-amber-900' : 'text-slate-800';
  const muted = theme === 'dark' ? 'text-slate-400' : theme === 'sepia' ? 'text-amber-600' : 'text-slate-500';
  const rowHover = theme === 'dark' ? 'hover:bg-slate-800' : theme === 'sepia' ? 'hover:bg-amber-100/60' : 'hover:bg-slate-50';
  const btnActive = theme === 'dark' ? 'bg-slate-700 text-slate-100' : theme === 'sepia' ? 'bg-amber-800 text-white' : 'bg-slate-900 text-white';
  const btnInactive = theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : theme === 'sepia' ? 'bg-amber-200 text-amber-700 hover:bg-amber-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${bg} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border ${border} flex flex-col max-h-[80vh]`}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className={`px-6 py-4 border-b ${border} ${headerBg} flex justify-between items-center shrink-0`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-slate-700' : theme === 'sepia' ? 'bg-amber-800' : 'bg-slate-900'} text-white`}>
              <Download size={16} />
            </div>
            <div>
              <div className={`font-bold text-sm ${text}`}>导出章节</div>
              <div className={`text-[10px] ${muted}`}>勾选要导出的章节</div>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${rowHover} ${muted} transition-colors`} type="button">
            <X size={16} />
          </button>
        </div>

        {/* 格式选择 */}
        <div className={`px-6 py-3 border-b ${border} flex items-center space-x-2 shrink-0`}>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${muted} mr-2`}>格式</span>
          <button
            onClick={() => setFmt("txt")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${fmt === "txt" ? btnActive : btnInactive}`}
            type="button"
          >TXT</button>
          <button
            onClick={() => setFmt("docx")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${fmt === "docx" ? btnActive : btnInactive}`}
            type="button"
          >DOCX</button>
        </div>

        {/* 全选行 */}
        <div className={`px-6 py-2.5 border-b ${border} shrink-0`}>
          <label className={`flex items-center space-x-3 cursor-pointer ${rowHover} rounded-lg px-1 py-1 transition-colors`}>
            <input
              type="checkbox"
              checked={selected.size === chapters.length}
              onChange={toggleAll}
              className="w-3.5 h-3.5 accent-slate-900 cursor-pointer"
            />
            <span className={`text-xs font-bold ${text}`}>全选 ({chapters.length} 章)</span>
          </label>
        </div>

        {/* 章节列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-0.5">
          {chapters.map(c => (
            <label key={c.id} className={`flex items-center space-x-3 cursor-pointer ${rowHover} rounded-lg px-1 py-2 transition-colors`}>
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="w-3.5 h-3.5 accent-slate-900 cursor-pointer shrink-0"
              />
              <FileText size={12} className={muted} />
              <span className={`text-xs truncate ${text}`}>{c.title}</span>
            </label>
          ))}
        </div>

        {/* 底部操作 */}
        <div className={`px-6 py-4 border-t ${border} flex items-center justify-between shrink-0`}>
          <span className={`text-[10px] ${muted}`}>已选 {selected.size} / {chapters.length} 章</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${btnInactive}`}
              type="button"
            >取消</button>
            <button
              onClick={handleExport}
              disabled={selected.size === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${btnActive} disabled:opacity-40 disabled:cursor-not-allowed`}
              type="button"
            >
              导出 {selected.size > 0 ? `${selected.size} 章` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ─────────────────────────────────────────────────────────────────────
export default function ChapterList({ bookId, chapters, onChaptersChange, onChapterSelect, selectedChapterId, theme, colors, onToggleLeft }: ChapterListProps) {
  const [loading] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleCreateChapter = async () => {
    if (!bookId) return;
    try {
      const newChapter = await api.createChapterInBook(bookId, {
        title: `第 ${chapters.length + 1} 章`,
        content: "",
        order: chapters.length + 1,
      });
      onChaptersChange([...chapters, newChapter]);
      onChapterSelect(newChapter.id);
      setEditingId(newChapter.id);
      setEditingTitle(newChapter.title);
    } catch (error) {
      console.error("Failed to create chapter", error);
    }
  };

  const startEdit = (chapter: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chapter.id);
    setEditingTitle(chapter.title);
  };

  const confirmEdit = async () => {
    if (!editingId) return;
    const trimmed = editingTitle.trim();
    if (!trimmed) { cancelEdit(); return; }
    try {
      if (bookId) {
        await api.updateChapterInBook(bookId, editingId, { title: trimmed });
      } else {
        await api.updateChapter(editingId, { title: trimmed });
      }
      onChaptersChange(chapters.map(c => c.id === editingId ? { ...c, title: trimmed } : c));
    } catch (error) {
      console.error("Failed to rename chapter", error);
    } finally {
      setEditingId(null);
    }
  };

  const cancelEdit = () => { setEditingId(null); setEditingTitle(""); };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") confirmEdit();
    if (e.key === "Escape") cancelEdit();
  };

  const handleDelete = async (chapter: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定删除「${chapter.title}」？此操作不可撤销。`)) return;
    try {
      if (bookId) {
        await api.deleteChapterInBook(bookId, chapter.id);
      } else {
        await api.deleteChapter(chapter.id);
      }
      onChaptersChange(chapters.filter(c => c.id !== chapter.id));
      if (selectedChapterId === chapter.id) onChapterSelect(-1);
    } catch (error) {
      console.error("Failed to delete chapter", error);
    }
  };

  const bgClass = theme === 'dark' ? 'bg-slate-900' : theme === 'sepia' ? 'bg-amber-50/80' : 'bg-slate-50/60';
  const borderClass = theme === 'dark' ? 'border-slate-800' : theme === 'sepia' ? 'border-amber-200' : 'border-slate-100';
  const cardBgClass = theme === 'dark' ? 'bg-slate-800/80' : theme === 'sepia' ? 'bg-amber-100/50' : 'bg-white/90';
  const textClass = theme === 'dark' ? 'text-slate-300' : theme === 'sepia' ? 'text-amber-700' : 'text-slate-600';
  const headingClass = theme === 'dark' ? 'text-slate-100' : theme === 'sepia' ? 'text-amber-900' : 'text-slate-900';
  const mutedClass = theme === 'dark' ? 'text-slate-500' : theme === 'sepia' ? 'text-amber-500' : 'text-slate-400';
  const hoverBgClass = theme === 'dark' ? 'hover:bg-slate-800' : theme === 'sepia' ? 'hover:bg-amber-100/80' : 'hover:bg-white/80';
  const selectedBgClass = theme === 'dark' ? 'bg-slate-800 ring-slate-700' : theme === 'sepia' ? 'bg-amber-100 ring-amber-300' : 'bg-white ring-slate-200';

  return (
    <div className={`flex flex-col h-full ${bgClass} border-r ${borderClass}`}>
      {/* 顶部品牌栏 */}
      <div className={`px-4 py-3 border-b ${borderClass} flex justify-between items-center ${cardBgClass} shrink-0`}>
        <div className="flex items-center space-x-2">
          <div className={`w-6 h-6 ${theme === 'dark' ? 'bg-slate-700' : theme === 'sepia' ? 'bg-amber-800' : 'bg-slate-900'} rounded-md flex items-center justify-center text-white font-black text-[10px]`}>V</div>
          <span className={`font-bold ${headingClass} text-sm tracking-tight`}>VibeWriter</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleCreateChapter}
            className={`w-7 h-7 flex items-center justify-center ${hoverBgClass} rounded-lg ${textClass} transition-colors`}
            title="新建章节"
            type="button"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={onToggleLeft}
            className={`w-7 h-7 flex items-center justify-center ${hoverBgClass} rounded-lg ${mutedClass} transition-colors`}
            title="收起目录"
            type="button"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      {/* 章节列表 */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar py-2 px-2`}>
        {loading ? (
          <div className="px-3 py-6 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-8 ${theme === 'dark' ? 'bg-slate-800' : theme === 'sepia' ? 'bg-amber-100' : 'bg-slate-100'} rounded-lg animate-pulse`} />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className="px-4 py-10 text-center space-y-2">
            <p className={`text-xs ${mutedClass}`}>暂无章节</p>
            <p className={`text-[10px] ${mutedClass} opacity-60`}>点击右上角 + 开始创作</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {chapters.map((chapter) => (
              <li
                key={chapter.id}
                onClick={() => editingId !== chapter.id && onChapterSelect(chapter.id)}
                onMouseEnter={() => setHoveredId(chapter.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group relative px-3 py-2 cursor-pointer rounded-lg transition-all ${
                  selectedChapterId === chapter.id
                    ? `${selectedBgClass} shadow-sm ring-1`
                    : hoverBgClass
                }`}
              >
                {editingId === chapter.id ? (
                  <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                    <input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      className={`flex-1 text-xs bg-transparent border-b ${theme === 'dark' ? 'border-slate-600' : theme === 'sepia' ? 'border-amber-500' : 'border-slate-400'} focus:outline-none ${headingClass} py-0.5`}
                    />
                    <button onClick={confirmEdit} className="p-1 text-emerald-500 hover:text-emerald-700" type="button"><Check size={12} /></button>
                    <button onClick={cancelEdit} className={`p-1 ${mutedClass}`} type="button"><X size={12} /></button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold shrink-0 w-4 text-right ${
                      selectedChapterId === chapter.id ? textClass : mutedClass
                    }`}>
                      {String(chapter.order || 0).padStart(2, "0")}
                    </span>
                    <span className={`flex-1 text-xs truncate ${
                      selectedChapterId === chapter.id ? `${headingClass} font-semibold` : textClass
                    }`}>
                      {chapter.title}
                    </span>
                    {hoveredId === chapter.id && (
                      <div className="flex items-center space-x-0.5 shrink-0">
                        <button
                          onClick={(e) => startEdit(chapter, e)}
                          className={`p-1 ${mutedClass} hover:${textClass} rounded transition-colors`}
                          type="button"
                          title="重命名"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(chapter, e)}
                          className={`p-1 ${mutedClass} hover:text-red-500 rounded transition-colors`}
                          type="button"
                          title="删除"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 底部工具栏 */}
      <div className={`p-2 border-t ${borderClass} ${cardBgClass} space-y-0.5 shrink-0`}>
        <a
          href="/settings"
          className={`flex items-center space-x-2.5 px-3 py-2 text-xs ${textClass} ${hoverBgClass} rounded-lg transition-all`}
        >
          <Settings size={13} className={`${mutedClass} shrink-0`} />
          <span className="font-medium">设置 / 知识库</span>
        </a>
        <button
          onClick={() => setIsExportOpen(true)}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs ${textClass} ${hoverBgClass} rounded-lg transition-all`}
          type="button"
        >
          <Download size={13} className={`${mutedClass} shrink-0`} />
          <span className="font-medium">导出章节</span>
        </button>
      </div>

      {isExportOpen && (
        <ExportModal
          chapters={chapters}
          onClose={() => setIsExportOpen(false)}
          theme={theme}
        />
      )}
    </div>
  );
}
