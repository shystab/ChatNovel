"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api, withAccessToken } from "@/lib/api";
import AppBackgroundLayers from "@/components/app-background-layers";

type UserBackgroundShellProps = {
  children: ReactNode;
  className?: string;
  dim?: number;
};

export default function UserBackgroundShell({
  children,
  className = "",
  dim = 58,
}: UserBackgroundShellProps) {
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [blur, setBlur] = useState(0);

  useEffect(() => {
    let active = true;
    api.getSettings()
      .then((settings) => {
        if (!active || !settings.background_image_path) return;
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
        setBackgroundUrl(withAccessToken(`${apiBase}/settings/background?v=${encodeURIComponent(settings.background_image_path)}`));
        setBlur(settings.background_blur ?? 0);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <main className={`relative min-h-[100dvh] overflow-x-hidden ${backgroundUrl ? "novelcat-background-active bg-slate-900" : "novelcat-social-shell"} ${className}`}>
      <AppBackgroundLayers url={backgroundUrl} blur={blur} dim={dim} mode="page" />
      <div className="relative min-h-[100dvh]">{children}</div>
    </main>
  );
}
