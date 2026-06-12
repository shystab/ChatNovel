"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpenText, Eye, EyeOff, GitBranch, Globe2, KeyRound, Loader2, LockKeyhole, LogIn, ShieldCheck, UserRound, UserPlus } from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginCoverUrl, setLoginCoverUrl] = useState("");

  useEffect(() => {
    setLoginCoverUrl(api.loginCoverUrl(Date.now()));
  }, []);

  const title = mode === "login" ? "回到你的故事里" : "加入这间写作室";

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
      const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
      router.replace(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败";
      setError(message.includes("detail") ? "用户名、密码或邀请码不正确" : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="novelcat-login-shell relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-6 text-slate-100 sm:px-7 sm:py-8">
      <div className="novelcat-login-grid absolute inset-0" aria-hidden="true" />
      <section className="novelcat-login-frame relative grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="novelcat-login-cover relative hidden min-h-[660px] overflow-hidden p-9 text-white lg:flex lg:flex-col xl:p-11">
          {loginCoverUrl && (
            // The static cover in CSS remains visible when no admin cover exists.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={loginCoverUrl}
              alt=""
              className="novelcat-login-cover-image"
              onError={(event) => { event.currentTarget.style.display = "none"; }}
              aria-hidden="true"
            />
          )}
          <div className="relative flex items-center gap-3">
            <Image src="/icon.svg" alt="NovelCat" width={44} height={44} className="rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.22)]" priority />
            <div>
              <div className="text-lg font-semibold text-white">NovelCat</div>
              <div className="text-xs text-slate-300">朋友之间的私人写作空间</div>
            </div>
          </div>

          <div className="relative my-auto max-w-md py-12">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/8 px-2.5 py-1.5 text-xs font-medium text-slate-200">
              <BookOpenText size={14} className="text-orange-300" />
              写作、记忆与 AI 助手
            </div>
            <h1 className="max-w-sm text-4xl font-semibold leading-[1.28] text-white">
              写下故事，保留属于自己的节奏。
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">
              管理长篇小说、检索全书上下文，并在真正需要时让 AI 和朋友加入。
            </p>
            <div className="mt-8 grid max-w-md grid-cols-2 gap-2.5 text-xs text-slate-200">
              <div className="novelcat-login-note">
                <ShieldCheck size={16} className="text-orange-300" />
                独立书库与知识库
              </div>
              <div className="novelcat-login-note">
                <KeyRound size={17} className="text-orange-300" />
                邀请码控制访问
              </div>
            </div>
          </div>

          <div className="relative flex items-end justify-between gap-5 border-t border-white/12 pt-5">
            <p className="max-w-[15rem] text-xs leading-5 text-slate-400">
              一个仍在生长的私人项目，由 shystab 制作。
            </p>
            <div className="flex gap-2">
              <a
                href="https://github.com/shystab"
                target="_blank"
                rel="noreferrer"
                className="novelcat-login-link"
              >
                <GitBranch size={15} />
                GitHub
                <ArrowUpRight size={12} />
              </a>
              <a
                href="https://shystab.github.io/"
                target="_blank"
                rel="noreferrer"
                className="novelcat-login-link"
              >
                <Globe2 size={15} />
                博客
                <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </aside>

        <div className="novelcat-login-form flex min-h-[620px] flex-col justify-center px-6 py-8 text-slate-900 sm:px-12 sm:py-10 lg:min-h-[660px] lg:px-14 xl:px-16">
          <div className="mb-10 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-3">
              <Image src="/icon.svg" alt="NovelCat" width={40} height={40} className="rounded-lg" priority />
              <span className="text-lg font-semibold">NovelCat</span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="https://github.com/shystab"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="GitHub"
                aria-label="打开 GitHub"
              >
                <GitBranch size={18} />
              </a>
              <a
                href="https://shystab.github.io/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="我的博客"
                aria-label="打开我的博客"
              >
                <Globe2 size={18} />
              </a>
            </div>
          </div>

          <div className="max-w-sm">
            <p className="text-xs font-semibold text-orange-600">{mode === "login" ? "NOVELCAT / 登录" : "NOVELCAT / 注册"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === "login" ? "继续写作、整理章节，或找 AI 讨论下一段。" : "使用朋友提供的邀请码，创建属于你的私人书库。"}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-lg bg-slate-200/55 p-1" role="tablist" aria-label="账户操作">
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
                className={`rounded-md px-3 py-2.5 text-sm font-semibold ${
                  mode === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">用户名</span>
              <div className="novelcat-login-input">
                <UserRound size={16} aria-hidden="true" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  autoComplete="username"
                  placeholder="你的用户名"
                  required
                />
              </div>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">密码</span>
              <div className="novelcat-login-input">
                <LockKeyhole size={16} aria-hidden="true" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="至少 8 个字符"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
            {mode === "register" && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">邀请码</span>
                <div className="novelcat-login-input">
                  <KeyRound size={16} aria-hidden="true" />
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    autoComplete="off"
                    placeholder="第一位用户可以留空"
                  />
                </div>
              </label>
            )}

            <div aria-live="polite" className="min-h-6">
              {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#182033] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(24,32,51,0.18)] hover:bg-[#253047] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : mode === "login" ? <LogIn size={17} /> : <UserPlus size={17} />}
              {busy ? "正在处理" : mode === "login" ? "登录 NovelCat" : "创建账户"}
            </button>
          </form>

          <p className="mt-7 text-center text-xs leading-5 text-slate-400">
            私人部署不会公开你的书籍、对话与知识库。
          </p>
        </div>
      </section>
    </main>
  );
}
