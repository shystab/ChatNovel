"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, MessageCircle, PenLine } from "lucide-react";
import { api } from "@/lib/api";
import type { ShowcaseCard, UserProfile } from "@/types/api";

function displayName(user: UserProfile | null) {
  if (!user) return "";
  return user.display_name?.trim() || user.username;
}

function initials(user: UserProfile | null) {
  return (displayName(user) || "?").slice(0, 2).toUpperCase();
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

  useEffect(() => {
    void load();
  }, [load]);

  const isMe = me?.username === profile?.username;

  return (
    <main className="min-h-screen bg-[#f7f1e7] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5">
        <header className="flex items-center justify-between border-b border-stone-300 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/people"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-slate-700 shadow-sm hover:bg-stone-50"
              title="回到伙伴"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">个人主页</h1>
              <p className="text-sm text-slate-600">创作者主动展示给朋友看的内容</p>
            </div>
          </div>
          {profile && (
            isMe ? (
              <Link
                href="/people/me"
                className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <PenLine size={16} />
                管理我的主页
              </Link>
            ) : (
              <Link
                href="/people/chat"
                className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <MessageCircle size={16} />
                聊天
              </Link>
            )
          )}
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin" />
            加载中
          </div>
        ) : error || !profile ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            {error || "用户不存在"}
          </div>
        ) : (
          <section className="grid flex-1 min-h-0 grid-cols-[340px_minmax(0,1fr)] gap-5 py-5">
            <aside className="min-h-0 border-r border-stone-300 pr-5">
              <div className="rounded-md border border-stone-300 bg-white p-4 shadow-sm">
                <div
                  className="relative h-24 w-24 overflow-hidden rounded-md text-xl font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: profile.avatar_color || "#f97316",
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center">{initials(profile)}</div>
                  {profile.avatar_image_path && (
                    <img
                      src={api.avatarUrl(profile.username)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>
                <h2 className="mt-4 text-2xl font-semibold">{displayName(profile)}</h2>
                <div className="mt-1 text-sm text-slate-500">@{profile.username}</div>
                {profile.is_admin && (
                  <div className="mt-3 inline-flex rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                    管理员
                  </div>
                )}
                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {profile.bio || "这个创作者还没有留下简介。"}
                </p>
              </div>

              <div className="mt-4 rounded-md border border-stone-300 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-stone-500">正在写</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {profile.current_work || "还没有填写正在创作的内容。"}
                </p>
              </div>

            </aside>

            <section className="grid min-h-0 grid-cols-[320px_minmax(0,1fr)] gap-4">
              <aside className="min-h-0 overflow-hidden">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">展示卡片</h2>
                  <span className="text-xs text-slate-500">{cards.length} 张</span>
                </div>
                <div className="custom-scrollbar flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-3">
                  {cards.length === 0 && (
                    <div className="rounded-md border border-dashed border-stone-300 bg-white/70 px-4 py-12 text-center text-sm leading-6 text-slate-500">
                      还没有公开展示卡片
                    </div>
                  )}
                  {cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedId(card.id)}
                      className={`overflow-hidden rounded-md border bg-white text-left shadow-sm ${
                        selectedCard?.id === card.id ? "border-orange-300" : "border-stone-300 hover:border-stone-400"
                      }`}
                    >
                      <div
                        className="aspect-[16/9] bg-stone-100"
                        style={{
                          backgroundImage: card.cover_image_path ? `url("${api.showcaseCoverUrl(card.id, card.updated_at)}")` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div className="p-3">
                        <h3 className="line-clamp-1 text-sm font-semibold">{card.title}</h3>
                        {card.subtitle && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{card.subtitle}</p>}
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
                          {card.excerpt || "没有摘录"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <article className="custom-scrollbar min-h-0 overflow-y-auto rounded-md border border-stone-300 bg-white p-5 shadow-sm">
                {selectedCard ? (
                  <>
                    <div
                      className="mb-5 aspect-[21/9] overflow-hidden rounded-md bg-stone-100"
                      style={{
                        backgroundImage: selectedCard.cover_image_path ? `url("${api.showcaseCoverUrl(selectedCard.id, selectedCard.updated_at)}")` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                    <div className="flex items-start gap-3">
                      <BookOpen size={22} className="mt-1 text-orange-500" />
                      <div className="min-w-0">
                        <h2 className="text-2xl font-semibold">{selectedCard.title}</h2>
                        {selectedCard.subtitle && <p className="mt-1 text-sm text-slate-500">{selectedCard.subtitle}</p>}
                      </div>
                    </div>
                    {selectedCard.excerpt && (
                      <blockquote className="mt-5 border-l-4 border-orange-300 pl-4 text-sm leading-7 text-slate-600">
                        {selectedCard.excerpt}
                      </blockquote>
                    )}
                    <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-slate-800">
                      {selectedCard.content || "这个展示卡片还没有详情内容。"}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    选择一张展示卡片
                  </div>
                )}
              </article>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
