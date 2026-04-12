"use client";

import React, { useState, useEffect } from "react";
import { KnowledgeBase } from "@/types/api";
import { api } from "@/lib/api";
import { 
  X, 
  Upload, 
  Trash2, 
  FileText, 
  Database, 
  Loader2,
  AlertCircle
} from "lucide-react";

interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: any;
  colors?: any;
}

export default function KnowledgeModal({ isOpen, onClose }: KnowledgeModalProps) {
  const [items, setItems] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getKnowledgeBases();
      setItems(data);
    } catch {
      setError("无法获取知识库列表");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      await api.uploadKnowledgeBase(file);
      await loadData();
    } catch {
      setError("文件上传失败，请确保格式正确（txt/pdf/docx）");
    } finally {
      setUploading(false);
      // 清空 input 方便重复上传同名文件
      e.target.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个文档吗？")) return;
    try {
      await api.deleteKnowledgeBase(id);
      await loadData();
    } catch {
      setError("删除失败");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-900 rounded-2xl text-white">
              <Database size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">知识库</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">上传语料，用于检索增强生成</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3 text-slate-700 text-sm">
              <AlertCircle size={18} />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="mb-8">
            <label className="relative group cursor-pointer block">
              <input 
                type="file" 
                className="hidden" 
                onChange={handleUpload}
                disabled={uploading}
                accept=".txt,.pdf,.docx"
              />
              <div className={`border-2 border-dashed rounded-[20px] p-10 flex flex-col items-center justify-center transition-all ${
                uploading 
                  ? "bg-slate-50 border-slate-200" 
                  : "bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50"
              }`}>
                {uploading ? (
                  <Loader2 size={32} className="text-slate-700 animate-spin mb-4" />
                ) : (
                  <Upload size={32} className="text-slate-400 group-hover:text-slate-700 transition-colors mb-4" />
                )}
                <span className="text-sm font-bold text-slate-600">
                  {uploading ? "正在解析并向量化..." : "点击或拖拽上传写作语料"}
                </span>
                <span className="text-[10px] text-slate-400 mt-2">支持 TXT, PDF, DOCX • 自动切片存储</span>
              </div>
            </label>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">已加载的知识片段</h3>
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-slate-200" size={32} /></div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-slate-300 italic text-sm border-2 border-dotted border-slate-100 rounded-[24px]">
                暂无知识语料，上传文件以开启 RAG 增强
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {items.map((item) => (
                  <div key={item.id} className="group p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center hover:bg-slate-50 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-slate-50 rounded-xl text-slate-500 transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-700 truncate max-w-[300px]">{item.title}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {item.chunk_count} 个知识切片 • {item.created_at ? new Date(item.created_at).toLocaleDateString() : '刚刚'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="删除文档"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="px-8 py-6 bg-white border-t border-slate-100">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            * 知识库通过 **RAG (检索增强生成)** 技术工作。当您写作时，系统会自动检索最相关的片段注入 AI 上下文，帮助 AI 学习您的措辞、人设或世界观。
          </p>
        </footer>
      </div>
    </div>
  );
}
