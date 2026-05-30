"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Edit2, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
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

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const emptyForm = {
  name: "",
  description: "",
  system_prompt: "",
};

export default function PersonaManager() {
  const { theme } = useTheme();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isDark = theme === "dark";
  const isSepia = theme === "sepia";
  const cardBg = isDark ? "bg-slate-900/70 border-slate-800" : isSepia ? "bg-[#fbf7ed] border-amber-200" : "bg-white border-slate-200";
  const panelBg = isDark ? "bg-slate-950/35" : isSepia ? "bg-white/55" : "bg-slate-50";
  const headingTxt = isDark ? "text-slate-100" : isSepia ? "text-amber-950" : "text-slate-900";
  const bodyTxt = isDark ? "text-slate-300" : isSepia ? "text-amber-800" : "text-slate-700";
  const mutedTxt = isDark ? "text-slate-500" : isSepia ? "text-amber-600" : "text-slate-500";
  const hoverTxt = isDark ? "hover:text-slate-100" : isSepia ? "hover:text-amber-950" : "hover:text-slate-900";
  const borderCls = isDark ? "border-slate-800" : isSepia ? "border-amber-200" : "border-slate-200";
  const inputCls = isDark
    ? "bg-slate-950/40 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-slate-500"
    : isSepia
      ? "bg-white/65 border-amber-200 text-amber-950 placeholder:text-amber-400 focus:border-amber-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400";
  const primaryBtn = isDark ? "bg-slate-200 hover:bg-white text-slate-950" : isSepia ? "bg-amber-900 hover:bg-amber-800 text-white" : "bg-slate-900 hover:bg-slate-800 text-white";
  const secondaryBtn = isDark ? "bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-700" : isSepia ? "bg-[#f7f2e8] text-amber-800 hover:bg-amber-100 border-amber-200" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200";

  const loadPresets = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/presets/`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: PresetListResponse = await res.json();
      setPresets(data.items);
    } catch (error) {
      console.error("Failed to load presets", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setCreating(false);
    setError(null);
  };

  const savePreset = async () => {
    if (!formData.name.trim() || !formData.system_prompt.trim()) {
      setError("名称和系统提示词不能为空");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const isEditing = editingId !== null;
      const res = await fetch(`${BASE}/presets/${isEditing ? editingId : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      resetForm();
      await loadPresets();
    } catch (error) {
      console.error("Failed to save preset", error);
      setError("保存失败，请检查后端服务是否正常运行");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/presets/${id}/toggle`, { method: "PATCH" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await loadPresets();
      setError(null);
    } catch (error) {
      console.error("Failed to toggle preset", error);
      setError("切换失败，请稍后再试");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/presets/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await loadPresets();
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete preset", error);
      setError("删除失败，请稍后再试");
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (preset: Preset) => {
    setFormData({
      name: preset.name,
      description: preset.description,
      system_prompt: preset.system_prompt,
    });
    setEditingId(preset.id);
    setCreating(false);
    setError(null);
  };

  return (
    <div className="space-y-5">
      <div className={`flex items-center justify-between border-b ${borderCls} pb-3`}>
        <div>
          <h2 className={`text-base font-semibold ${headingTxt}`}>AI 人格预设</h2>
          <p className={`text-xs mt-1 ${mutedTxt}`}>给写作助手准备不同的语气、视角和工作方式。</p>
        </div>

        {!creating && editingId === null && (
          <button
            onClick={() => setCreating(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-semibold text-sm ${primaryBtn}`}
          >
            <Plus size={16} />
            <span>新建预设</span>
          </button>
        )}
      </div>

      {error && (
        <div className={`px-3 py-2 rounded-md border text-xs ${isDark ? "bg-red-950/35 border-red-900 text-red-300" : "bg-red-50 border-red-200 text-red-700"}`}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={28} />
        </div>
      ) : (
        <>
          {(creating || editingId !== null) && (
            <div className={`p-5 rounded-lg border ${cardBg} space-y-4`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold text-sm ${headingTxt}`}>
                  {creating ? "新建人格预设" : "编辑人格预设"}
                </h3>
                <button
                  onClick={resetForm}
                  className={`${mutedTxt} ${hoverTxt} transition-colors`}
                  aria-label="关闭编辑"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid gap-3">
                <label className="block">
                  <span className={`text-sm font-semibold ${bodyTxt} block mb-2`}>预设名称</span>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：冷静编辑、温柔陪写、严肃剧情顾问"
                    className={`w-full px-3 py-2 border rounded-md text-sm outline-none transition-colors ${inputCls}`}
                  />
                </label>

                <label className="block">
                  <span className={`text-sm font-semibold ${bodyTxt} block mb-2`}>描述</span>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="简单写一下这个人格适合什么场景"
                    className={`w-full px-3 py-2 border rounded-md text-sm outline-none transition-colors ${inputCls}`}
                  />
                </label>

                <label className="block">
                  <span className={`text-sm font-semibold ${bodyTxt} block mb-2`}>System Prompt</span>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="你是一个专业的小说写作助手..."
                    rows={8}
                    className={`w-full px-3 py-2 border rounded-md text-sm outline-none transition-colors font-mono resize-y min-h-44 ${inputCls}`}
                  />
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={savePreset}
                  disabled={saving}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-semibold text-sm disabled:opacity-60 ${primaryBtn}`}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  <span>{editingId ? "保存更改" : "创建预设"}</span>
                </button>
                <button
                  onClick={resetForm}
                  className={`px-4 py-2 rounded-md border transition-colors font-semibold text-sm ${secondaryBtn}`}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {presets.length === 0 ? (
              <div className={`text-center py-12 ${mutedTxt}`}>
                <Sparkles size={42} className="mx-auto mb-4 opacity-50" />
                <p className="font-medium">还没有创建任何人格预设</p>
                <p className="text-sm mt-1">点击上方按钮创建第一个预设</p>
              </div>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`p-4 rounded-lg border transition-colors ${cardBg} ${
                    preset.is_enabled ? (isSepia ? "border-amber-500" : "border-slate-500") : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className={`font-semibold ${headingTxt}`}>{preset.name}</h4>
                        {preset.is_enabled && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${panelBg} ${bodyTxt} border ${borderCls}`}>
                            已启用
                          </span>
                        )}
                      </div>
                      {preset.description && (
                        <p className={`text-sm ${mutedTxt}`}>{preset.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(preset.id)}
                        className={`p-2 rounded-md border transition-colors ${
                          preset.is_enabled
                            ? isDark
                              ? "bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700"
                              : isSepia
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
                            : secondaryBtn
                        }`}
                        title={preset.is_enabled ? "禁用" : "启用"}
                      >
                        <Sparkles size={16} />
                      </button>
                      <button
                        onClick={() => startEdit(preset)}
                        className={`p-2 rounded-md border transition-colors ${secondaryBtn}`}
                        title="编辑"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(preset)}
                        className="p-2 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-colors border border-red-100"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className={`${panelBg} rounded-md p-3 border ${borderCls}`}>
                    <p className={`text-xs ${mutedTxt} font-mono line-clamp-3 whitespace-pre-wrap`}>
                      {preset.system_prompt}
                    </p>
                  </div>

                  <div className={`mt-3 text-xs ${mutedTxt}`}>
                    创建于 {new Date(preset.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除人格预设"
        description={`确定要删除“${deleteTarget?.name || "未命名预设"}”吗？这个操作不可撤销。`}
        confirmLabel="删除"
        tone="danger"
        theme={theme}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
