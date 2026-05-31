"use client";

import { AlertTriangle, Check, FileText, Plus, RotateCcw, X } from "lucide-react";
import type { Theme } from "@/hooks/use-theme";
import type { AgentEditPlan } from "@/types/api";

interface AgentApplyReviewProps {
  open: boolean;
  theme: Theme;
  currentContent: string;
  proposal: string;
  plan?: AgentEditPlan | null;
  warnings?: string[];
  onCancel: () => void;
  onApply?: (mode: "append" | "replace") => void;
  onApplyPlan?: () => void;
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export default function AgentApplyReview({
  open,
  theme,
  currentContent,
  proposal,
  plan,
  warnings = [],
  onCancel,
  onApply,
  onApplyPlan,
}: AgentApplyReviewProps) {
  if (!open) return null;

  const isDark = theme === "dark";
  const isSepia = theme === "sepia";
  const panelBg = isDark ? "bg-slate-900 border-slate-700" : isSepia ? "bg-[#fbf7ed] border-amber-200" : "bg-white border-slate-200";
  const headingTxt = isDark ? "text-slate-100" : isSepia ? "text-amber-950" : "text-slate-900";
  const bodyTxt = isDark ? "text-slate-300" : isSepia ? "text-amber-800" : "text-slate-700";
  const mutedTxt = isDark ? "text-slate-500" : isSepia ? "text-amber-600" : "text-slate-500";
  const previewBg = isDark ? "bg-slate-950/55 border-slate-800" : isSepia ? "bg-white/55 border-amber-200" : "bg-slate-50 border-slate-200";
  const secondaryBtn = isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700" : isSepia ? "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200";
  const primaryBtn = isDark ? "bg-slate-200 hover:bg-white text-slate-950" : isSepia ? "bg-amber-900 hover:bg-amber-800 text-white" : "bg-slate-900 hover:bg-slate-800 text-white";
  const dangerBtn = "bg-red-600 hover:bg-red-700 text-white";
  const currentPreview = stripHtml(currentContent) || "当前章节还是空的。";
  const isPlan = Boolean(plan);
  const riskLabel = plan?.risk === "high" ? "高风险" : plan?.risk === "low" ? "低风险" : "中风险";

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/35 backdrop-blur-sm px-4">
      <div className={`w-full max-w-4xl rounded-lg border ${panelBg} shadow-xl overflow-hidden flex flex-col max-h-[86vh]`}>
        <header className={`px-5 py-4 border-b ${isDark ? "border-slate-800" : isSepia ? "border-amber-200" : "border-slate-100"} flex items-start justify-between gap-4 shrink-0`}>
          <div>
            <div className="flex items-center gap-2">
              <FileText size={17} className={mutedTxt} />
              <h2 className={`text-sm font-semibold ${headingTxt}`}>{isPlan ? "Agent 修改预览" : "写入预览"}</h2>
            </div>
            <p className={`text-xs ${mutedTxt} mt-1`}>
              {isPlan ? "AI 只生成修改方案，确认后才会应用到当前章节。" : "AI 的内容不会直接改正文，确认后才会写入当前章节。"}
            </p>
          </div>
          <button type="button" onClick={onCancel} className={`p-1.5 rounded-md ${mutedTxt} hover:bg-black/5 transition-colors`} aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        {plan && (
          <div className={`px-5 py-3 border-b ${isDark ? "border-slate-800" : isSepia ? "border-amber-200" : "border-slate-100"} space-y-2`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold ${headingTxt}`}>{plan.summary || "AI 修改方案"}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                plan.risk === "high" ? "bg-red-100 text-red-700" :
                plan.risk === "low" ? "bg-emerald-100 text-emerald-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                {riskLabel}
              </span>
            </div>
            {plan.operations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {plan.operations.map((op, index) => (
                  <span key={`${op.action}-${index}`} className={`text-[10px] px-2 py-1 rounded-md border ${previewBg} ${bodyTxt}`}>
                    {index + 1}. {op.action}{op.reason ? `：${op.reason}` : ""}
                  </span>
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className={`flex items-start gap-2 text-[11px] ${plan.risk === "high" ? "text-red-600" : mutedTxt}`}>
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{warnings.join("；")}</span>
              </div>
            )}
          </div>
        )}

        <main className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar">
          <section className="min-w-0">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedTxt} mb-2`}>当前章节</div>
            <pre className={`h-[44vh] overflow-auto custom-scrollbar whitespace-pre-wrap rounded-lg border p-4 text-xs leading-relaxed ${previewBg} ${bodyTxt}`}>
              {currentPreview}
            </pre>
          </section>
          <section className="min-w-0">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedTxt} mb-2`}>{isPlan ? "修改后预览" : "AI 建议内容"}</div>
            <pre className={`h-[44vh] overflow-auto custom-scrollbar whitespace-pre-wrap rounded-lg border p-4 text-xs leading-relaxed ${previewBg} ${bodyTxt}`}>
              {proposal || "没有可写入的内容。"}
            </pre>
          </section>
        </main>

        <footer className={`px-5 py-3 border-t ${isDark ? "border-slate-800 bg-slate-950/40" : isSepia ? "border-amber-200 bg-amber-50/50" : "border-slate-100 bg-slate-50/80"} flex flex-wrap items-center justify-between gap-3 shrink-0`}>
          <p className={`text-[11px] ${mutedTxt}`}>
            {isPlan ? "应用方案会用右侧预览覆盖当前章节；保存仍由编辑器自动保存/手动保存处理。" : "替换会覆盖当前章节内容；追加只会把 AI 内容加到末尾。"}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className={`px-3 py-2 rounded-md border text-xs font-semibold transition-colors ${secondaryBtn}`}>
              取消
            </button>
            {isPlan ? (
              <button type="button" onClick={onApplyPlan} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${primaryBtn}`}>
                <Check size={13} />
                应用方案
              </button>
            ) : (
              <>
                <button type="button" onClick={() => onApply?.("append")} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${primaryBtn}`}>
                  <Plus size={13} />
                  追加到末尾
                </button>
                <button type="button" onClick={() => onApply?.("replace")} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${dangerBtn}`}>
                  <RotateCcw size={13} />
                  替换当前章节
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
