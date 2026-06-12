"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, ImagePlus, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { api, setStoredUser } from "@/lib/api";
import type { ShowcaseCard, UserProfile } from "@/types/api";
import UserBackgroundShell from "@/components/user-background-shell";

const AVATAR_COLORS = ["#f97316", "#fb7185", "#a855f7", "#38bdf8", "#22c55e", "#eab308"];

function displayName(user: UserProfile | null) {
  if (!user) return "";
  return user.display_name?.trim() || user.username;
}

function initials(user: UserProfile | null) {
  return (displayName(user) || "?").slice(0, 2).toUpperCase();
}

export default function MyPeoplePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cards, setCards] = useState<ShowcaseCard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [currentWorkInput, setCurrentWorkInput] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [status, setStatus] = useState("");

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedId) || null,
    [cards, selectedId]
  );

  const [cardTitle, setCardTitle] = useState("");
  const [cardSubtitle, setCardSubtitle] = useState("");
  const [cardExcerpt, setCardExcerpt] = useState("");
  const [cardContent, setCardContent] = useState("");
  const [cardPublic, setCardPublic] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const [nextProfile, nextCards] = await Promise.all([
        api.getMyProfile(),
        api.listMyShowcases(),
      ]);
      setProfile(nextProfile);
      setStoredUser({
        username: nextProfile.username,
        display_name: nextProfile.display_name,
        bio: nextProfile.bio,
        current_work: nextProfile.current_work,
        avatar_color: nextProfile.avatar_color,
        avatar_image_path: nextProfile.avatar_image_path,
        show_background_on_profile: nextProfile.show_background_on_profile,
        is_admin: nextProfile.is_admin,
      });
      setDisplayNameInput(nextProfile.display_name || nextProfile.username);
      setBioInput(nextProfile.bio || "");
      setCurrentWorkInput(nextProfile.current_work || "");
      setAvatarColor(nextProfile.avatar_color || AVATAR_COLORS[0]);
      setCards(nextCards);
      setSelectedId((current) => current || nextCards[0]?.id || null);
    } catch (err) {
      console.error(err);
      setStatus("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedCard) {
      setCardTitle("");
      setCardSubtitle("");
      setCardExcerpt("");
      setCardContent("");
      setCardPublic(true);
      return;
    }
    setCardTitle(selectedCard.title);
    setCardSubtitle(selectedCard.subtitle || "");
    setCardExcerpt(selectedCard.excerpt || "");
    setCardContent(selectedCard.content || "");
    setCardPublic(selectedCard.is_public);
  }, [selectedCard]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setStatus("");
    try {
      const updated = await api.updateMyProfile({
        display_name: displayNameInput,
        bio: bioInput,
        current_work: currentWorkInput,
        avatar_color: avatarColor,
      });
      setProfile(updated);
      setStoredUser({
        username: updated.username,
        display_name: updated.display_name,
        bio: updated.bio,
        current_work: updated.current_work,
        avatar_color: updated.avatar_color,
        avatar_image_path: updated.avatar_image_path,
        show_background_on_profile: updated.show_background_on_profile,
        is_admin: updated.is_admin,
      });
      setStatus("主页资料已保存");
    } catch (err) {
      console.error(err);
      setStatus("保存资料失败");
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus("");
    try {
      const updated = await api.uploadMyAvatar(file);
      setProfile(updated);
      setStoredUser({
        username: updated.username,
        display_name: updated.display_name,
        bio: updated.bio,
        current_work: updated.current_work,
        avatar_color: updated.avatar_color,
        avatar_image_path: updated.avatar_image_path,
        show_background_on_profile: updated.show_background_on_profile,
        is_admin: updated.is_admin,
      });
      setStatus("头像已更新");
    } catch (err) {
      console.error(err);
      setStatus("头像上传失败，请确认图片小于 3MB");
    }
  };

  const createCard = async () => {
    setSavingCard(true);
    setStatus("");
    try {
      const created = await api.createShowcase({
        title: "新的展示卡片",
        excerpt: "写一段放在个人主页上的摘录。",
        content: "这里可以放更完整的展示内容。",
        is_public: true,
        sort_order: cards.length,
      });
      setCards((current) => [created, ...current]);
      setSelectedId(created.id);
      setStatus("已创建展示卡片");
    } catch (err) {
      console.error(err);
      setStatus("创建卡片失败");
    } finally {
      setSavingCard(false);
    }
  };

  const saveCard = async () => {
    if (!selectedCard) return;
    setSavingCard(true);
    setStatus("");
    try {
      const updated = await api.updateShowcase(selectedCard.id, {
        title: cardTitle,
        subtitle: cardSubtitle,
        excerpt: cardExcerpt,
        content: cardContent,
        is_public: cardPublic,
      });
      setCards((current) => current.map((card) => card.id === updated.id ? updated : card));
      setStatus("展示卡片已保存");
    } catch (err) {
      console.error(err);
      setStatus("保存卡片失败");
    } finally {
      setSavingCard(false);
    }
  };

  const deleteCard = async () => {
    if (!selectedCard) return;
    if (!window.confirm(`删除「${selectedCard.title}」？`)) return;
    setSavingCard(true);
    setStatus("");
    try {
      await api.deleteShowcase(selectedCard.id);
      const remaining = cards.filter((card) => card.id !== selectedCard.id);
      setCards(remaining);
      setSelectedId(remaining[0]?.id || null);
      setStatus("展示卡片已删除");
    } catch (err) {
      console.error(err);
      setStatus("删除卡片失败");
    } finally {
      setSavingCard(false);
    }
  };

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedCard) return;
    setSavingCard(true);
    setStatus("");
    try {
      const updated = await api.uploadShowcaseCover(selectedCard.id, file);
      setCards((current) => current.map((card) => card.id === updated.id ? updated : card));
      setStatus("封面已更新");
    } catch (err) {
      console.error(err);
      setStatus("封面上传失败，请确认图片小于 8MB");
    } finally {
      setSavingCard(false);
    }
  };

  return (
    <UserBackgroundShell dim={62}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-7 sm:py-7">
        <header className="novelcat-surface flex items-center justify-between rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-slate-700 shadow-sm hover:bg-stone-50"
              title="回到写作"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">我的主页</h1>
              <p className="text-sm text-slate-600">管理别人能看到的头像、简介、创作状态和展示片段</p>
            </div>
          </div>
          {profile && (
            <Link
              href={`/people/${encodeURIComponent(profile.username)}`}
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-stone-50"
            >
              <Eye size={16} />
              预览主页
            </Link>
          )}
        </header>

        {status && (
          <div className="novelcat-surface mt-4 rounded-md px-4 py-3 text-sm text-slate-700">
            {status}
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin" />
            加载中
          </div>
        ) : (
          <section className="grid flex-1 min-h-0 grid-cols-1 gap-4 py-5 xl:grid-cols-[320px_300px_minmax(0,1fr)]">
            <aside className="novelcat-surface min-h-0 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md text-base font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: avatarColor,
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center">{initials(profile)}</div>
                  {profile?.avatar_image_path && (
                    <img
                      src={api.avatarUrl(profile.username, profile.avatar_image_path)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-stone-50">
                  <Upload size={16} />
                  上传头像
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={uploadAvatar} />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">昵称</span>
                  <input
                    value={displayNameInput}
                    onChange={(event) => setDisplayNameInput(event.target.value)}
                    className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">简介</span>
                  <textarea
                    value={bioInput}
                    onChange={(event) => setBioInput(event.target.value)}
                    className="mt-1 h-24 w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-orange-400"
                    placeholder="介绍一下你和你的创作"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">正在写什么</span>
                  <textarea
                    value={currentWorkInput}
                    onChange={(event) => setCurrentWorkInput(event.target.value)}
                    className="mt-1 h-24 w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-orange-400"
                    placeholder="比如：一部发生在雾港和旧神之间的奇幻小说"
                  />
                </label>

                <div>
                  <div className="text-xs font-semibold text-slate-500">头像底色</div>
                  <div className="mt-2 flex gap-2">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setAvatarColor(color)}
                        className="flex h-8 w-8 items-center justify-center rounded-md shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {avatarColor === color && <Check size={16} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  保存主页资料
                </button>
              </div>
            </aside>

            <aside className="novelcat-surface min-h-0 overflow-hidden rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">展示卡片</h2>
                <button
                  type="button"
                  onClick={createCard}
                  disabled={savingCard}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60"
                  title="新增展示卡片"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="custom-scrollbar flex h-full min-h-0 flex-col gap-2 overflow-y-auto pb-3">
                {cards.length === 0 && (
                  <button
                    type="button"
                    onClick={createCard}
                    className="rounded-md border border-dashed border-stone-300 bg-white/70 px-4 py-8 text-center text-sm leading-6 text-slate-500 hover:bg-white"
                  >
                    还没有展示卡片。创建一张，把你愿意给朋友看的片段放上来。
                  </button>
                )}
                {cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedId(card.id)}
                    className={`rounded-md border px-3 py-3 text-left ${
                      card.id === selectedId
                        ? "border-orange-300 bg-orange-50"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{card.title}</span>
                      {card.is_public ? <Eye size={14} className="text-slate-400" /> : <EyeOff size={14} className="text-slate-400" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {card.excerpt || "没有摘录"}
                    </p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="novelcat-surface-strong min-h-0 overflow-hidden rounded-lg p-4">
              {selectedCard ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-800">编辑展示卡片</h2>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCardPublic((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50"
                      >
                        {cardPublic ? <Eye size={16} /> : <EyeOff size={16} />}
                        {cardPublic ? "公开" : "隐藏"}
                      </button>
                      <button
                        type="button"
                        onClick={deleteCard}
                        disabled={savingCard}
                        className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <div
                        className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-md border border-stone-300 bg-stone-100 text-sm text-stone-500"
                        style={{
                          backgroundImage: selectedCard.cover_image_path ? `url("${api.showcaseCoverUrl(selectedCard.id, selectedCard.updated_at)}")` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        {!selectedCard.cover_image_path && <ImagePlus size={32} />}
                      </div>
                      <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50">
                        <Upload size={16} />
                        上传封面
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={uploadCover} />
                      </label>
                    </div>

                    <div className="custom-scrollbar min-h-0 space-y-4 overflow-y-auto pr-1">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">标题</span>
                        <input
                          value={cardTitle}
                          onChange={(event) => setCardTitle(event.target.value)}
                          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">副标题</span>
                        <input
                          value={cardSubtitle}
                          onChange={(event) => setCardSubtitle(event.target.value)}
                          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
                          placeholder="可选"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">主页摘录</span>
                        <textarea
                          value={cardExcerpt}
                          onChange={(event) => setCardExcerpt(event.target.value)}
                          className="mt-1 h-24 w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-orange-400"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">详情内容</span>
                        <textarea
                          value={cardContent}
                          onChange={(event) => setCardContent(event.target.value)}
                          className="mt-1 h-64 w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-orange-400"
                          placeholder="这里放点进去后能看到的内容"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end border-t border-stone-300 pt-3">
                    <button
                      type="button"
                      onClick={saveCard}
                      disabled={savingCard}
                      className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      {savingCard ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      保存卡片
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-stone-300 bg-white/60">
                  <button
                    type="button"
                    onClick={createCard}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <Plus size={16} />
                    创建第一张展示卡片
                  </button>
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </UserBackgroundShell>
  );
}
