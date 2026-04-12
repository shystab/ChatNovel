"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { KnowledgeBase } from "@/types/api";
import { X, FileText, Database, Check, Loader2 } from "lucide-react";
import type { Theme } from "@/hooks/use-theme";

interface DocumentSelectorProps {
  conversationId: number | null;
  isOpen: boolean;
  onClose: () => void;
  initialSelectedIds: number[];
  onSave: (selectedIds: number[]) => void;
  theme: Theme;
}

export default function DocumentSelector({
  conversationId,
  isOpen,
  onClose,
  initialSelectedIds,
  onSave,
  theme,
}: DocumentSelectorProps) {
  const [documents, setDocuments] = useState<KnowledgeBase[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDark = theme === "dark";
  const isSepia = theme === "sepia";
  const bg = isDark ? "bg-slate-900 border-slate-700" : isSepia ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200";
  const headerBg = isDark ? "bg-slate-900 border-slate-700" : isSepia ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100";
  const headingTxt = isDark ? "text-slate-100" : isSepia ? "text-amber-900" : "text-slate-900";
  const mutedTxt = isDark ? "text-slate-500" : isSepia ? "text-amber-500" : "text-slate-400";
  const bodyTxt = isDark ? "text-slate-300" : isSepia ? "text-amber-800" : "text-slate-700";
  const itemBg = isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-750" : isSepia ? "bg-amber-100/50 border-amber-200 hover:bg-amber-100" : "bg-white border-slate-200 hover:bg-slate-50";
  const selectedBg = isDark ? "bg-slate-700 border-slate-500" : isSepia ? "bg-amber-200 border-amber-400" : "bg-slate-50 border-slate-400";
  const iconBg = isDark ? "bg-slate-700 text-slate-300" : isSepia ? "bg-amber-200 text-amber-700" : "bg-slate-100 text-slate-500";
  const iconSelectedBg = isDark ? "bg-slate-500 text-white" : isSepia ? "bg-amber-700 text-white" : "bg-slate-900 text-white";
  const primaryBtn = isDark ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800";
  const cancelBtn = isDark ? "text-slate-400 hover:bg-slate-800" : isSepia ? "text-amber-600 hover:bg-amber-100" : "text-slate-600 hover:bg-slate-100";

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedIds));
      loadDocuments();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await api.getKnowledgeBases();
      setDocuments(data);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!conversationId) return;
    setSaving(true);
    try {
      await api.updateConversationDocs(conversationId, Array.from(selectedIds));
      onSave(Array.from(selectedIds));
      onClose();
    } catch {
      // 保存失败时仍关闭，本地状态已更新
      onSave(Array.from(selectedIds));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`${bg} border rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]`}>
        {/* 标题栏 */}
        <header className={`px-6 py-4 border-b ${headerBg} flex items-center justify-between shrink-0`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <Database size={16} className={mutedTxt} />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${headingTxt}`}>选择参考文档</h2>
              <p className={`text-[10px] ${mutedTxt}`}>仅本次对话生效，不影响其他对话</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${cancelBtn} transition-colors`} type="button">
            <X size={16} />
          </button>
        </header>

        {/* 文档列表 */}
        <main className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 size={24} className={`animate-spin ${mutedTxt}`} />
            </div>
          ) : documents.length === 0 ? (
            <div className={`py-12 text-center text-sm ${mutedTxt} border-2 border-dashed ${isDark ? "border-slate-700" : "border-slate-200"} rounded-2xl`}>
              暂无知识库文档，请先在设置页面上传
            </div>
          ) : (
            documents.map(doc => {
              const selected = selectedIds.has(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggle(doc.id)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-2xl border transition-all text-left ${selected ? selectedBg : itemBg}`}
                >
                  <div className={`p-2 rounded-xl shrink-0 transition-colors ${selected ? iconSelectedBg : iconBg}`}>
                    <FileText size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${headingTxt}`}>{doc.title}</p>
                    <p className={`text-[10px] ${mutedTxt} mt-0.5`}>{doc.chunk_count} 个知识切片</p>
                  </div>
                  {selected && (
                    <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? "bg-slate-400" : "bg-slate-900"}`}>
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </main>

        {/* 底部操作 */}
        <footer className={`px-6 py-4 border-t ${headerBg} flex items-center justify-between shrink-0`}>
          <span className={`text-[10px] ${mutedTxt}`}>
            已选 {selectedIds.size} 个文档{selectedIds.size === 0 ? "（不使用外部知识库）" : ""}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs rounded-xl transition-colors ${cancelBtn}`}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 ${primaryBtn}`}
            >
              {saving ? "保存中…" : "确认"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
