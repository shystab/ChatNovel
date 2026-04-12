"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Plus, Check, X, Edit2, Trash2, Loader2 } from "lucide-react";

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

export default function PersonaManager() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_prompt: "",
  });

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const res = await fetch(`${BASE}/presets/`);
      const data: PresetListResponse = await res.json();
      setPresets(data.items);
    } catch (error) {
      console.error("Failed to load presets", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.system_prompt.trim()) {
      alert("名称和系统提示词不能为空");
      return;
    }

    try {
      const res = await fetch(`${BASE}/presets/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({ name: "", description: "", system_prompt: "" });
        setCreating(false);
        await loadPresets();
      }
    } catch (error) {
      console.error("Failed to create preset", error);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!formData.name.trim() || !formData.system_prompt.trim()) {
      alert("名称和系统提示词不能为空");
      return;
    }

    try {
      const res = await fetch(`${BASE}/presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({ name: "", description: "", system_prompt: "" });
        setEditingId(null);
        await loadPresets();
      }
    } catch (error) {
      console.error("Failed to update preset", error);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await fetch(`${BASE}/presets/${id}/toggle`, {
        method: "PATCH",
      });
      await loadPresets();
    } catch (error) {
      console.error("Failed to toggle preset", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个人格预设吗？")) return;

    try {
      await fetch(`${BASE}/presets/${id}`, {
        method: "DELETE",
      });
      await loadPresets();
    } catch (error) {
      console.error("Failed to delete preset", error);
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
  };

  const cancelEdit = () => {
    setFormData({ name: "", description: "", system_prompt: "" });
    setEditingId(null);
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
          <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
          <h2 className="text-lg font-bold text-slate-800">AI 人格预设</h2>
        </div>

        {!creating && !editingId && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-all shadow-lg shadow-purple-100 font-semibold text-sm"
          >
            <Plus size={16} />
            <span>创建新预设</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : (
        <>
          {/* 创建/编辑表单 */}
          {(creating || editingId !== null) && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-purple-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">
                  {creating ? "创建新人格预设" : "编辑人格预设"}
                </h3>
                <button
                  onClick={cancelEdit}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">
                    预设名称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：严肃学术风格"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">
                    描述（可选）
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="简短描述这个人格的特点"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">
                    System Prompt
                  </label>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="你是一个专业的小说写作助手..."
                    rows={8}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all font-mono resize-none"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => (editingId ? handleUpdate(editingId) : handleCreate())}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-all font-semibold text-sm"
                >
                  <Check size={16} />
                  <span>{editingId ? "保存更改" : "创建预设"}</span>
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all font-semibold text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 预设列表 */}
          <div className="space-y-3">
            {presets.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-medium">还没有创建任何人格预设</p>
                <p className="text-sm mt-1">点击上方按钮创建第一个预设</p>
              </div>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`bg-white p-5 rounded-2xl border-2 transition-all ${
                    preset.is_enabled
                      ? "border-purple-300 shadow-lg shadow-purple-50"
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h4 className="font-bold text-slate-800">{preset.name}</h4>
                        {preset.is_enabled && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs font-bold">
                            已启用
                          </span>
                        )}
                      </div>
                      {preset.description && (
                        <p className="text-sm text-slate-500">{preset.description}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggle(preset.id)}
                        className={`p-2 rounded-lg transition-all ${
                          preset.is_enabled
                            ? "bg-purple-100 text-purple-600 hover:bg-purple-200"
                            : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}
                        title={preset.is_enabled ? "禁用" : "启用"}
                      >
                        <Sparkles size={16} />
                      </button>
                      <button
                        onClick={() => startEdit(preset)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="编辑"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id)}
                        className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 font-mono line-clamp-3">
                      {preset.system_prompt}
                    </p>
                  </div>

                  <div className="mt-3 text-xs text-slate-400">
                    创建于 {new Date(preset.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
