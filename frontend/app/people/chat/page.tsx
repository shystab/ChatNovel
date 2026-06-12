"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, Send, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import type { DirectMessage, UserProfile } from "@/types/api";
import UserBackgroundShell from "@/components/user-background-shell";

function displayName(user: UserProfile | null) {
  if (!user) return "";
  return user.display_name?.trim() || user.username;
}

function initials(user: UserProfile | null) {
  return (displayName(user) || "?").slice(0, 2).toUpperCase();
}

function Avatar({ user, size = "h-10 w-10" }: { user: UserProfile; size?: string }) {
  const hasImage = Boolean(user.avatar_image_path);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md text-xs font-bold text-white shadow-sm ${size}`}
      style={{ backgroundColor: user.avatar_color || "#f97316" }}
    >
      <div className="flex h-full w-full items-center justify-center">{initials(user)}</div>
      {hasImage && (
        <img
          src={api.avatarUrl(user.username, user.avatar_image_path)}
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

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PeopleChatPage() {
  const [me, setMe] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const selectedUser = useMemo(
    () => users.find((user) => user.username === selectedUsername) || null,
    [selectedUsername, users]
  );

  const loadUsers = useCallback(async () => {
    setStatus("");
    const [profile, userList] = await Promise.all([
      api.getMyProfile(),
      api.listUsers(),
    ]);
    setMe(profile);
    setUsers(userList);
    const requestedUsername = new URLSearchParams(window.location.search).get("with") || "";
    setSelectedUsername((current) => {
      if (current) return current;
      if (userList.some((user) => user.username === requestedUsername)) return requestedUsername;
      return userList[0]?.username || "";
    });
  }, []);

  const loadMessages = useCallback(async (username: string) => {
    if (!username) {
      setMessages([]);
      return;
    }
    setThreadLoading(true);
    try {
      const data = await api.listDirectMessages(username);
      setMessages(data);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        await loadUsers();
      } catch (err) {
        console.error(err);
        setStatus("加载联系人失败");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUsername) return;
    void loadMessages(selectedUsername).catch((err) => {
      console.error(err);
      setStatus("加载聊天失败");
    });
  }, [loadMessages, selectedUsername]);

  const send = async () => {
    if (!selectedUser) return;
    const content = input.trim();
    if (!content) return;
    setSending(true);
    setStatus("");
    try {
      const created = await api.sendDirectMessage(selectedUser.username, content);
      setMessages((current) => [...current, created]);
      setInput("");
    } catch (err) {
      console.error(err);
      setStatus("发送失败");
    } finally {
      setSending(false);
    }
  };

  return (
    <UserBackgroundShell dim={64}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-7 sm:py-7">
        <header className="novelcat-surface flex items-center justify-between rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/people"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-slate-700 shadow-sm hover:bg-stone-50"
              title="回到伙伴"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">聊天</h1>
              <p className="text-sm text-slate-600">和朋友聊创作、反馈、设定或者随便扯两句</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadUsers().then(() => {
                if (selectedUsername) {
                  void loadMessages(selectedUsername);
                }
              });
            }}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-stone-50"
          >
            <RefreshCw size={16} />
            刷新
          </button>
        </header>

        {status && (
          <div className="novelcat-surface mt-4 rounded-md px-4 py-3 text-sm text-slate-700">
            {status}
          </div>
        )}

        <section className="novelcat-surface-strong mt-5 grid min-h-[620px] flex-1 overflow-hidden rounded-lg md:min-h-0 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-hidden border-r border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">联系人</h2>
              <span className="text-xs text-slate-500">{users.length} 人</span>
            </div>
            <div className="custom-scrollbar flex h-full min-h-0 flex-col gap-2 overflow-y-auto pb-3">
              {loading && (
                <div className="flex items-center gap-2 rounded-md bg-white px-3 py-3 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  加载中
                </div>
              )}
              {!loading && users.length === 0 && (
                <div className="rounded-md border border-dashed border-stone-300 bg-white/70 px-3 py-8 text-center text-sm text-slate-500">
                  还没有其他用户
                </div>
              )}
              {users.map((user) => {
                const active = user.username === selectedUsername;
                return (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => setSelectedUsername(user.username)}
                    className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-orange-300 bg-orange-50"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <Avatar user={user} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{displayName(user)}</div>
                      <div className="truncate text-xs text-slate-500">@{user.username}</div>
                      {user.current_work && (
                        <div className="mt-1 line-clamp-1 text-xs text-slate-500">{user.current_work}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-[480px] flex-col bg-white/55 md:min-h-0">
            {selectedUser ? (
              <>
                <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar user={selectedUser} size="h-11 w-11" />
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">{displayName(selectedUser)}</div>
                      <div className="truncate text-xs text-slate-500">@{selectedUser.username}</div>
                    </div>
                  </div>
                  <Link
                    href={`/people/${encodeURIComponent(selectedUser.username)}`}
                    className="rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-stone-50"
                  >
                    主页
                  </Link>
                </div>

                <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {threadLoading && (
                    <div className="flex justify-center text-xs text-slate-400">
                      <Loader2 size={15} className="mr-2 animate-spin" />
                      加载聊天
                    </div>
                  )}
                  {!threadLoading && messages.length === 0 && (
                    <div className="mx-auto mt-20 max-w-sm rounded-md border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-sm leading-6 text-slate-500">
                      还没有聊天记录。
                    </div>
                  )}
                  {messages.map((message) => {
                    const mine = message.sender_username === me?.username;
                    return (
                      <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] rounded-md px-3 py-2 text-sm leading-6 shadow-sm ${
                            mine
                              ? "novelcat-chat-mine bg-slate-950 text-white"
                              : "novelcat-chat-other border border-stone-200 bg-stone-50 text-slate-800"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{message.content}</div>
                          <div className={`mt-1 text-[11px] ${mine ? "text-slate-300" : "text-slate-400"}`}>
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 border-t border-stone-200 p-3">
                  <textarea
                    value={input}
                    aria-label={`给 ${displayName(selectedUser)} 发消息`}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    className="h-20 min-w-0 flex-1 resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-orange-400"
                    placeholder={`给 ${displayName(selectedUser)} 发消息`}
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="inline-flex h-20 w-24 items-center justify-center gap-2 rounded-md bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                    发送
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center text-sm text-slate-500">
                  <UserRound className="mx-auto mb-3 text-slate-300" size={36} />
                  选择联系人开始聊天
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </UserBackgroundShell>
  );
}
