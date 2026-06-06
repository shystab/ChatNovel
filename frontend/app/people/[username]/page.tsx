"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, Loader2, MessageCircle, PenLine, Quote, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { ShowcaseCard, UserProfile } from "@/types/api";
import AppBackgroundLayers from "@/components/app-background-layers";

const nameOf = (user: UserProfile | null) => user?.display_name?.trim() || user?.username || "";
const initialsOf = (user: UserProfile | null) => (nameOf(user) || "?").slice(0, 2).toUpperCase();

function joinedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });
}

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username || "");
  const [me, setMe] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cards, setCards] = useState<ShowcaseCard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedId) || cards[0] || null,
    [cards, selectedId]
  );

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const [myProfile, targetProfile, targetCards] = await Promise.all([
        api.getMyProfile().catch(() => null),
        api.getUserProfile(username),
        api.listUserShowcases(username),
      ]);
      setMe(myProfile);
      setProfile(targetProfile);
      setCards(targetCards);
      setSelectedId(targetCards[0]?.id || null);
    } catch (err) {
      console.error(err);
      setError("加载个人主页失败");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { void load(); }, [load]);

  const isMe = me?.username === profile?.username;
  const backgroundUrl = profile?.show_background_on_profile
    ? api.userBackgroundUrl(profile.username)
    : null;

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#111827] text-white">
      {!backgroundUrl && <div className="fixed inset-0 bg-[radial-gradient(circle_at_76%_18%,#475569_0,transparent_34%),radial-gradient(circle_at_14%_86%,#7c4a32_0,transparent_30%),linear-gradient(135deg,#111827,#273449)]" />}
      <AppBackgroundLayers url={backgroundUrl} dim={58} mode="profile" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1480px] flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="profile-glass flex items-center justify-between rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Link href={isMe ? "/" : "/people"} className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20" title={isMe ? "回到写作" : "回到伙伴"}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-white">NovelCat 作者主页</h1>
              <p className="text-[11px] text-white/75">@{username}</p>
            </div>
          </div>
          {profile && (isMe ? (
            <Link href="/people/me" className="profile-action"><PenLine size={15} />管理主页</Link>
          ) : (
            <Link href={`/people/chat?with=${encodeURIComponent(profile.username)}`} className="profile-action"><MessageCircle size={15} />开始聊天</Link>
          ))}
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-white/70"><Loader2 size={18} className="mr-2 animate-spin" />加载中</div>
        ) : error || !profile ? (
          <div className="flex flex-1 items-center justify-center text-sm text-white/70">{error || "用户不存在"}</div>
        ) : (
          <div className="grid flex-1 gap-4 py-4 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-5">
            <aside className="profile-glass flex flex-col rounded-xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
              <div className="flex items-center gap-4 lg:block">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full text-xl font-bold shadow-[0_10px_28px_rgba(0,0,0,0.28)] lg:mx-auto lg:h-28 lg:w-28" style={{ backgroundColor: profile.avatar_color || "#f97316" }}>
                  <div className="flex h-full w-full items-center justify-center">{initialsOf(profile)}</div>
                  {profile.avatar_image_path && <img src={api.avatarUrl(profile.username, profile.avatar_image_path)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 lg:mt-5 lg:text-center">
                  <div className="flex flex-wrap items-center gap-2 lg:justify-center">
                    <h2 className="truncate text-2xl font-semibold text-white">{nameOf(profile)}</h2>
                    {profile.is_admin && <span className="rounded bg-amber-300/15 px-2 py-1 text-[10px] font-semibold text-amber-100">管理员</span>}
                  </div>
                  <p className="mt-1 text-xs text-white/75">@{profile.username}</p>
                </div>
              </div>

              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/95">{profile.bio || "这个创作者还没有留下简介。"}</p>
              <div className="mt-5 rounded-lg bg-black/30 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-100"><Sparkles size={14} />正在写</div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/85">{profile.current_work || "还没有填写正在创作的内容。"}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-black/25 px-3 py-3"><div className="text-lg font-semibold">{cards.length}</div><div className="mt-0.5 text-white/75">公开作品</div></div>
                <div className="rounded-md bg-black/25 px-3 py-3"><CalendarDays size={16} className="mb-1.5 text-white/85" /><div className="text-white/75">{joinedAt(profile.created_at)} 加入</div></div>
              </div>
              <div className="mt-auto hidden pt-8 text-center text-[10px] text-white/55 lg:block">NovelCat 创作者空间</div>
            </aside>

            <section className="min-w-0 space-y-4">
              {cards.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {cards.map((card) => {
                    const active = selectedCard?.id === card.id;
                    return (
                      <button key={card.id} type="button" onClick={() => setSelectedId(card.id)} className={`profile-work-card group relative min-h-44 overflow-hidden rounded-xl p-5 text-left ${active ? "ring-1 ring-white/60" : ""}`}>
                        {card.cover_image_path && <div className="absolute inset-0 bg-cover bg-center opacity-25 transition-transform duration-500 group-hover:scale-[1.03]" style={{ backgroundImage: `url("${api.showcaseCoverUrl(card.id, card.updated_at)}")` }} />}
                        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-[#121827]/30 to-black/45" />
                        <div className="relative flex h-full flex-col">
                          <div className="flex items-start justify-between gap-4"><BookOpen size={18} className="text-amber-100" /><ChevronRight size={17} className="text-white/75 transition-transform group-hover:translate-x-1" /></div>
                          <div className="mt-auto pt-8"><h3 className="text-xl font-semibold text-white">{card.title}</h3><p className="mt-2 line-clamp-2 text-xs leading-6 text-white/85">{card.subtitle || card.excerpt || "暂无简介"}</p></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <article className="profile-reader min-h-[520px] overflow-hidden rounded-xl">
                {selectedCard ? (
                  <>
                    <div className="relative min-h-56 bg-[#283346] bg-cover bg-center sm:min-h-72" style={{ backgroundImage: selectedCard.cover_image_path ? `url("${api.showcaseCoverUrl(selectedCard.id, selectedCard.updated_at)}")` : undefined }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/35 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                        <div className="flex items-center gap-2 text-xs font-medium text-amber-100"><BookOpen size={15} />作者公开片段</div>
                        <h2 className="mt-2 max-w-4xl text-3xl font-semibold text-white sm:text-4xl">{selectedCard.title}</h2>
                        {selectedCard.subtitle && <p className="mt-2 text-sm text-white/85">{selectedCard.subtitle}</p>}
                      </div>
                    </div>
                    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-9 sm:py-10">
                      {selectedCard.excerpt && <div className="mb-8 flex gap-4 border-b border-white/20 pb-7"><Quote size={20} className="mt-1 shrink-0 text-amber-200" /><p className="text-sm leading-7 text-white/88">{selectedCard.excerpt}</p></div>}
                      <div className="whitespace-pre-wrap font-['Novel_Serif',serif] text-base leading-9 text-white/95">{selectedCard.content || "这个展示作品还没有详情内容。"}</div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center"><BookOpen size={36} className="text-white/55" /><h2 className="mt-4 text-lg font-semibold text-white">还没有公开作品</h2><p className="mt-2 max-w-sm text-sm leading-6 text-white/80">作者公开展示的作品片段会出现在这里。</p></div>
                )}
              </article>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
