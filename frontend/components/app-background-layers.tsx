"use client";

type AppBackgroundLayersProps = {
  url?: string | null;
  blur?: number;
  dim?: number;
  mode?: "workspace" | "page" | "profile";
  position?: "absolute" | "fixed";
};

export default function AppBackgroundLayers({
  url,
  blur = 0,
  dim = 58,
  mode = "page",
  position = "fixed",
}: AppBackgroundLayersProps) {
  if (!url) return null;

  const safeBlur = Math.min(Math.max(blur, 0), mode === "workspace" ? 18 : 8);
  const safeDim = Math.min(Math.max(dim, mode === "workspace" ? 16 : 38), 78) / 100;
  const placement = position === "absolute" ? "absolute" : "fixed";

  return (
    <div className={`${placement} inset-0 z-0 overflow-hidden`} aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url("${url}")`,
          filter: `blur(${safeBlur}px) saturate(1.06)`,
          transform: safeBlur ? "scale(1.04)" : undefined,
        }}
      />
      <div className="absolute inset-0 bg-slate-950" style={{ opacity: safeDim }} />
      <div
        className={
          mode === "workspace"
            ? "absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.34),rgba(15,23,42,0.14)_42%,rgba(2,6,23,0.30)),linear-gradient(135deg,rgba(236,72,153,0.06),transparent_42%,rgba(59,130,246,0.08))]"
            : mode === "profile"
              ? "absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45"
              : "absolute inset-0 bg-gradient-to-br from-slate-950/18 via-transparent to-slate-900/30"
        }
      />
    </div>
  );
}
