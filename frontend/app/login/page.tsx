"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
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

  const title = useMemo(() => mode === "login" ? "登录 NovelCat" : "邀请码注册", [mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") || "/");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <main className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-6">
      <section className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" alt="" width={40} height={40} className="rounded-md shadow-sm" priority />
          <div>
            <h1 className="font-bold text-lg">{title}</h1>
            <p className="text-xs text-slate-500">朋友私用版，注册需要邀请码。</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`px-3 py-2 rounded-md text-sm font-semibold border ${mode === "login" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`px-3 py-2 rounded-md text-sm font-semibold border ${mode === "register" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-500"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-500"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </div>
          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">邀请码</label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="第一位用户可留空"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-slate-900 text-white rounded-md px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {busy ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>
      </section>
    </main>
  );
}
