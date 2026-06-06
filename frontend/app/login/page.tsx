"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { GitBranch, Globe2, KeyRound, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => mode === "login" ? "欢迎回来" : "加入 NovelCat", [mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") || "/");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await api.login(username.trim(), password);
      } else {
        await api.register(username.trim(), password, inviteCode.trim());
      }
      router.replace(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败";
      setError(message.includes("detail") ? "用户名、密码或邀请码不正确" : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="novelcat-login-shell flex items-center justify-center px-4 py-8 text-slate-900 sm:px-6">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative hidden min-h-[620px] overflow-hidden bg-[#182033] p-9 text-white lg:flex lg:flex-col">
          <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
          <div className="absolute -right-24 top-36 h-64 w-64 rounded-full bg-orange-400/15 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <Image src="/icon.svg" alt="" width={42} height={42} className="rounded-lg" priority />
            <div>
              <div className="text-lg font-semibold">NovelCat</div>
              <div className="text-xs text-slate-400">朋友私用写作空间</div>
            </div>
          </div>

          <div className="relative mt-auto max-w-xs">
            <p className="text-2xl font-semibold leading-9 text-balance">
              安静地写作，需要时再让 AI 和朋友加入。
            </p>
            <div className="mt-8 space-y-4 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <ShieldCheck size={17} className="text-orange-300" />
                <span>每位用户拥有独立书库与知识库</span>
              </div>
              <div className="flex items-center gap-3">
                <KeyRound size={17} className="text-orange-300" />
                <span>邀请码控制访问范围</span>
              </div>
            </div>
            <div className="mt-8 flex gap-2">
              <a
                href="https://github.com/shystab"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/18 bg-white/8 px-3 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/14"
              >
                <GitBranch size={15} />
                GitHub
              </a>
              <a
                href="https://shystab.github.io/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/18 bg-white/8 px-3 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/14"
              >
                <Globe2 size={15} />
                我的博客
              </a>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col justify-center px-6 py-10 sm:px-12 lg:min-h-[620px] lg:px-16">
          <div className="mb-9 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-3">
              <Image src="/icon.svg" alt="" width={40} height={40} className="rounded-lg" priority />
              <span className="text-lg font-semibold">NovelCat</span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="https://github.com/shystab"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="GitHub"
              >
                <GitBranch size={18} />
              </a>
              <a
                href="https://shystab.github.io/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="我的博客"
              >
                <Globe2 size={18} />
              </a>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === "login" ? "登录后继续你的创作。" : "注册需要朋友提供的邀请码。"}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 border-b border-slate-200" role="tablist">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                onClick={() => {
                  setMode(item);
                  setError("");
                }}
                className={`relative px-3 py-3 text-sm font-semibold ${
                  mode === item ? "text-slate-950" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {item === "login" ? "登录" : "注册"}
                {mode === item && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-orange-500" />}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm outline-none hover:border-slate-400 focus:border-orange-500"
                autoComplete="username"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm outline-none hover:border-slate-400 focus:border-orange-500"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
            </label>
            {mode === "register" && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">邀请码</span>
                <input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm outline-none hover:border-slate-400 focus:border-orange-500"
                  placeholder="第一位用户可以留空"
                />
              </label>
            )}

            <div aria-live="polite" className="min-h-5">
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#182033] px-4 text-sm font-semibold text-white hover:bg-[#253047] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : mode === "login" ? <LogIn size={17} /> : <UserPlus size={17} />}
              {busy ? "正在处理" : mode === "login" ? "登录 NovelCat" : "创建账户"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
