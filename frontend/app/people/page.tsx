"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageCircle, PenLine, Sparkles, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import type { UserProfile } from "@/types/api";

function displayName(user: UserProfile) {
  return user.display_name?.trim() || user.username;
}

function initials(user: UserProfile) {
  return displayName(user).slice(0, 2).toUpperCase();
}

function Avatar({ user, size = "h-12 w-12" }: { user: UserProfile; size?: string }) {
  const hasImage = Boolean(user.avatar_image_path);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md text-sm font-bold text-white shadow-sm ${size}`}
      style={{
        backgroundColor: user.avatar_color || "#f97316",
      }}
    >
      <div className="flex h-full w-full items-center justify-center">{initials(user)}</div>
      {hasImage && (
        <img
          src={api.avatarUrl(user.username)}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function PeoplePage() {
  const [me, setMe] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profile, userList] = await Promise.all([
        api.getMyProfile(),
        api.listUsers(),
      ]);
      setMe(profile);
      setUsers(userList);
    } catch (err) {
      console.error(err);
      setError("加载用户失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allUsers = me ? [me, ...users] : users;

  return (
    <main className="min-h-screen bg-[#f7f1e7] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5">
        <header className="flex items-center justify-between border-b border-stone-300 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-slate-700 shadow-sm hover:bg-stone-50"
              title="回到写作"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">伙伴</h1>
              <p className="text-sm text-slate-600">看看朋友们正在写什么，以及他们主动展示的创作片段</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/people/chat"
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-stone-50"
            >
              <MessageCircle size={16} />
              聊天
            </Link>
            <Link
              href="/people/me"
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <PenLine size={16} />
              管理我的主页
            </Link>
          </div>
        </header>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin" />
            加载中
          </div>
        ) : (
          <section className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-3">
            {allUsers.map((user) => (
              <Link
                key={user.username}
                href={user.username === me?.username ? "/people/me" : `/people/${encodeURIComponent(user.username)}`}
                className="group flex min-h-56 flex-col rounded-md border border-stone-300 bg-white/90 p-4 shadow-sm hover:border-orange-300 hover:bg-white"
              >
                <div className="flex items-start gap-3">
                  <Avatar user={user} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold">{displayName(user)}</h2>
                      {user.username === me?.username && (
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                          我
                        </span>
                      )}
                      {user.is_admin && (
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          管理员
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">@{user.username}</p>
                  </div>
                  <Sparkles size={18} className="text-stone-300 group-hover:text-orange-400" />
                </div>

                <div className="mt-4 flex-1 space-y-3">
                  <div className="rounded-md bg-stone-50 px-3 py-2">
                    <div className="text-[11px] font-semibold text-stone-500">正在写</div>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-700">
                      {user.current_work || "还没有填写正在创作的内容"}
                    </p>
                  </div>
                  <p className="line-clamp-4 text-sm leading-6 text-slate-600">
                    {user.bio || "这个创作者还没有留下简介。"}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3 text-xs text-slate-500">
                  <span>个人主页</span>
                  <UserRound size={15} />
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
