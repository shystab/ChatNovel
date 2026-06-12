"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  ImagePlus,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import type { InviteCode, UserProfile } from "@/types/api";
import UserBackgroundShell from "@/components/user-background-shell";

function displayName(user: UserProfile) {
  return user.display_name?.trim() || user.username;
}

function formatDate(value?: string | null) {
  if (!value) return "从未登录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverVersion, setCoverVersion] = useState(Date.now());
  const [coverUrl, setCoverUrl] = useState("/login-cover.jpg");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteUses, setInviteUses] = useState(1);
  const [inviteDays, setInviteDays] = useState(14);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const profile = await api.getMyProfile();
      setMe(profile);
      if (!profile.is_admin) {
        setStatus("当前账号没有管理员权限。");
        return;
      }
      const [nextUsers, nextInvites] = await Promise.all([
        api.listAdminUsers(),
        api.listInvites(),
      ]);
      setUsers(nextUsers);
      setInvites(nextInvites);
    } catch (error) {
      console.error(error);
      setStatus("管理员数据加载失败，请重新登录后再试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCoverUrl(api.loginCoverUrl(coverVersion));
  }, [coverVersion]);

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    setStatus("");
    try {
      await api.uploadLoginCover(file);
      setCoverVersion(Date.now());
      setStatus("登录封面已更新。");
    } catch (error) {
      console.error(error);
      setStatus("登录封面上传失败，请确认图片小于 12MB。");
    } finally {
      setCoverBusy(false);
    }
  };

  const clearCover = async () => {
    if (!window.confirm("恢复为 NovelCat 默认登录封面？")) return;
    setCoverBusy(true);
    setStatus("");
    try {
      await api.clearLoginCover();
      setCoverVersion(Date.now());
      setStatus("已恢复默认登录封面。");
    } catch (error) {
      console.error(error);
      setStatus("恢复默认封面失败。");
    } finally {
      setCoverBusy(false);
    }
  };

  const createInvite = async () => {
    setInviteBusy(true);
    setStatus("");
    try {
      const invite = await api.createInvite(
        Math.max(1, inviteUses || 1),
        inviteDays > 0 ? inviteDays : null,
      );
      setInvites((current) => [invite, ...current]);
      setStatus("邀请码已生成。");
    } catch (error) {
      console.error(error);
      setStatus("邀请码生成失败。");
    } finally {
      setInviteBusy(false);
    }
  };

  const copyInvite = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setStatus("邀请码已复制。");
  };

  const updateUser = async (user: UserProfile, changes: { is_admin?: boolean; is_active?: boolean }) => {
    setBusyUser(user.username);
    setStatus("");
    try {
      const updated = await api.updateAdminUser(user.username, changes);
      setUsers((current) => current.map((item) => item.username === updated.username ? updated : item));
      setStatus(`${displayName(updated)} 的权限已更新。`);
    } catch (error) {
      console.error(error);
      setStatus("权限更新失败。不能停用自己，也必须保留至少一位有效管理员。");
    } finally {
      setBusyUser("");
    }
  };

  return (
    <UserBackgroundShell dim={66}>
      <div className="mx-auto min-h-screen w-full max-w-6xl px-5 py-5 sm:px-7 sm:py-7">
        <header className="novelcat-surface-strong flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/75 text-slate-700 shadow-sm hover:bg-white"
              aria-label="返回上一页"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-orange-600" />
                <h1 className="text-lg font-semibold text-slate-950">管理员中心</h1>
              </div>
              <p className="text-xs text-slate-600">管理站点门面、邀请码与用户访问权限</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white/80 px-3 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            刷新
          </button>
        </header>

        {status && (
          <div className="novelcat-surface mt-4 rounded-md px-4 py-3 text-sm font-medium text-slate-700">
            {status}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-white">
            <Loader2 size={18} className="mr-2 animate-spin" />
            正在读取管理员数据
          </div>
        ) : !me?.is_admin ? (
          <div className="novelcat-surface-strong mt-5 rounded-lg px-5 py-12 text-center text-sm text-slate-700">
            当前账号无法访问管理员中心。
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-5">
              <section className="novelcat-surface-strong overflow-hidden rounded-lg">
                <div className="border-b border-slate-200/70 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <ImagePlus size={17} className="text-orange-600" />
                    登录页封面
                  </div>
                  <p className="mt-1 text-xs text-slate-600">所有访客进入登录页时看到的站点级背景。</p>
                </div>
                <div className="p-4">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-slate-900">
                    <img
                      src={coverUrl}
                      alt="当前登录封面"
                      className="h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.src = "/login-cover.jpg"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 text-xs font-semibold text-white">当前登录封面</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                      {coverBusy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                      上传新封面
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={uploadCover} disabled={coverBusy} />
                    </label>
                    <button
                      type="button"
                      onClick={clearCover}
                      disabled={coverBusy}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white/80 px-3 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      恢复默认
                    </button>
                  </div>
                </div>
              </section>

              <section className="novelcat-surface-strong rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <KeyRound size={17} className="text-orange-600" />
                  邀请码
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-600">
                    可使用次数
                    <input type="number" min={1} max={50} value={inviteUses} onChange={(event) => setInviteUses(Number(event.target.value))} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white/75 px-3 text-sm text-slate-900 outline-none focus:border-orange-500" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    有效天数
                    <input type="number" min={0} max={365} value={inviteDays} onChange={(event) => setInviteDays(Number(event.target.value))} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white/75 px-3 text-sm text-slate-900 outline-none focus:border-orange-500" />
                  </label>
                </div>
                <button type="button" onClick={createInvite} disabled={inviteBusy} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-3 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50">
                  {inviteBusy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  生成邀请码
                </button>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {invites.slice(0, 8).map((invite) => (
                    <button key={invite.code} type="button" onClick={() => void copyInvite(invite.code)} className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-left hover:bg-white">
                      <code className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{invite.code}</code>
                      <span className={`text-[10px] font-semibold ${invite.is_active ? "text-emerald-700" : "text-slate-400"}`}>{invite.uses}/{invite.max_uses}</span>
                      <Copy size={13} className="text-slate-400" />
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <section className="novelcat-surface-strong min-w-0 rounded-lg">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <UsersRound size={17} className="text-orange-600" />
                    用户管理
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{users.length} 个账号，停用后该用户将无法登录。</p>
                </div>
              </div>
              <div className="divide-y divide-slate-200/70">
                {users.map((user) => {
                  const isSelf = user.username === me.username;
                  const isBusy = busyUser === user.username;
                  return (
                    <div key={user.username} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-slate-700 text-white">
                        <div className="flex h-full items-center justify-center text-sm font-bold">{displayName(user).slice(0, 2).toUpperCase()}</div>
                        {user.avatar_image_path && <img src={api.avatarUrl(user.username, user.avatar_image_path)} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-slate-950">{displayName(user)}</h2>
                          {isSelf && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">当前账号</span>}
                          {user.is_admin && <Crown size={14} className="text-amber-600" aria-label="管理员" />}
                          {!user.is_active && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">已停用</span>}
                        </div>
                        <p className="truncate text-xs text-slate-500">@{user.username} · 最近登录 {formatDate(user.last_login_at)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => void updateUser(user, { is_admin: !user.is_admin })}
                          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${user.is_admin ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 bg-white/75 text-slate-700 hover:bg-white"}`}
                        >
                          {user.is_admin ? <Crown size={14} /> : <UserRound size={14} />}
                          {user.is_admin ? "管理员" : "设为管理员"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => void updateUser(user, { is_active: !user.is_active })}
                          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${user.is_active ? "border-slate-300 bg-white/75 text-slate-700 hover:border-red-300 hover:text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          {user.is_active ? "停用" : "恢复"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </UserBackgroundShell>
  );
}
