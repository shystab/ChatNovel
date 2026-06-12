"use client";

import { useEffect, useState } from "react";
import { Clock3, Loader2, RotateCcw, X } from "lucide-react";

import { api } from "@/lib/api";
import type { Chapter, ChapterRevision } from "@/types/api";


export default function ChapterHistoryDialog({
  chapter,
  onClose,
  onRestore,
}: {
  chapter: Chapter;
  onClose: () => void;
  onRestore: (chapter: Chapter) => void;
}) {
  const [items, setItems] = useState<ChapterRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!chapter.book_id) return;
    api.listChapterRevisions(chapter.book_id, chapter.id)
      .then(setItems)
      .catch(() => setError("无法读取版本历史"))
      .finally(() => setLoading(false));
  }, [chapter.book_id, chapter.id]);

  const restore = async (revision: ChapterRevision) => {
    if (!chapter.book_id) return;
    if (!window.confirm("恢复这个历史版本？当前正文会先自动保存为一个版本。")) return;
    setRestoring(revision.id);
    setError("");
    try {
      const restored = await api.restoreChapterRevision(chapter.book_id, chapter.id, revision.id);
      onRestore(restored);
      onClose();
    } catch {
      setError("恢复失败，请稍后重试");
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="章节版本历史">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-white/25 bg-slate-50/95 shadow-2xl backdrop-blur-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Clock3 size={16} className="text-orange-600" />
              版本历史
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{chapter.title} · 最多保留 50 个自动快照</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-200" aria-label="关闭版本历史">
            <X size={17} />
          </button>
        </header>
        <div className="max-h-[65vh] overflow-y-auto p-3">
          {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500"><Loader2 size={16} className="mr-2 animate-spin" />加载历史版本</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">还没有历史版本。继续写作并保存后会自动生成。</div>
          ) : (
            <div className="space-y-2">
              {items.map((revision) => (
                <div key={revision.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{new Date(revision.created_at).toLocaleString("zh-CN")}</div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{revision.content.replace(/<[^>]+>/g, " ").trim() || "空白章节"}</p>
                  </div>
                  <button type="button" onClick={() => void restore(revision)} disabled={restoring !== null} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-700 disabled:opacity-50">
                    {restoring === revision.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
