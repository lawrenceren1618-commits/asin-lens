"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";

import { AtmospherePanel } from "@/components/atmosphere-panel";
import { SideQuote } from "@/components/side-quote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WeatherLayer } from "@/components/weather-layer";
import {
  applyAtmosphereToDocument,
  defaultAtmosphere,
  getEffectiveAtmosphere,
  resolveAutoAtmosphere,
  writeStoredAtmosphere,
  type AtmosphereState,
} from "@/lib/atmosphere";
import {
  apiFetch,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "@/lib/client-auth";
import {
  applyCustomBackgroundUrl,
  clearCustomBackground,
  loadCustomBackgroundUrl,
  processCustomBackground,
  readCustomBgMeta,
  type CustomBgMeta,
} from "@/lib/custom-bg";

type AuthState = "unknown" | "guest" | "checking" | "authed" | "invalid";

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const [token, setToken] = useState("");
  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [hint, setHint] = useState("");
  const [atmosphere, setAtmosphere] = useState<AtmosphereState>(defaultAtmosphere);
  const [customMeta, setCustomMeta] = useState<CustomBgMeta | null>(null);
  const customUrlRef = useRef<string | null>(null);

  const revokeCustomUrl = useCallback(() => {
    if (customUrlRef.current) {
      URL.revokeObjectURL(customUrlRef.current);
      customUrlRef.current = null;
    }
  }, []);

  const commitAtmosphere = useCallback((next: AtmosphereState) => {
    setAtmosphere(next);
    applyAtmosphereToDocument(next);
    writeStoredAtmosphere(next);
  }, []);

  const attachCustomUrl = useCallback(
    async (enabled: boolean) => {
      revokeCustomUrl();
      if (!enabled) {
        applyCustomBackgroundUrl(null);
        setCustomMeta(null);
        return;
      }
      const url = await loadCustomBackgroundUrl();
      if (!url) {
        applyCustomBackgroundUrl(null);
        setCustomMeta(null);
        return;
      }
      customUrlRef.current = url;
      applyCustomBackgroundUrl(url);
      setCustomMeta(readCustomBgMeta());
    },
    [revokeCustomUrl],
  );

  useEffect(() => {
    const next = getEffectiveAtmosphere();
    commitAtmosphere(next);
    void attachCustomUrl(next.useCustomBg);
    return () => revokeCustomUrl();
  }, [attachCustomUrl, commitAtmosphere, revokeCustomUrl]);

  useEffect(() => {
    if (atmosphere.mode !== "auto") return;
    const timer = window.setInterval(() => {
      const auto = resolveAutoAtmosphere();
      setAtmosphere((prev) => {
        if (
          prev.mode !== "auto" ||
          (prev.dayPart === auto.dayPart &&
            prev.season === auto.season &&
            prev.weather === auto.weather)
        ) {
          return prev;
        }
        const next = {
          mode: "auto" as const,
          useCustomBg: prev.useCustomBg,
          ...auto,
        };
        applyAtmosphereToDocument(next);
        writeStoredAtmosphere(next);
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [atmosphere.mode]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = getAdminToken();
      if (!stored) {
        if (!cancelled) setAuthState("guest");
        return;
      }

      if (!cancelled) setAuthState("checking");
      try {
        await apiFetch("/api/auth/session");
        if (cancelled) return;
        setAuthState("authed");
        setToken("");
        window.dispatchEvent(new Event("asin-lens-token-saved"));
      } catch {
        if (cancelled) return;
        setAuthState("invalid");
        setToken(stored);
        setHint("令牌无效，请核对 .env.local 中的 ADMIN_TOKEN");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveToken() {
    const value = token.trim();
    if (!value) {
      clearAdminToken();
      setAuthState("guest");
      setHint("已退出");
      window.dispatchEvent(new Event("asin-lens-token-saved"));
      return;
    }

    setAdminToken(value);
    setAuthState("checking");
    setHint("正在验证…");
    try {
      await apiFetch("/api/auth/session");
      setAuthState("authed");
      setToken("");
      setHint("登录成功");
      window.dispatchEvent(new Event("asin-lens-token-saved"));
      window.setTimeout(() => setHint(""), 2000);
    } catch {
      setAuthState("invalid");
      setHint("令牌无效，请重试");
    }
  }

  function logout() {
    clearAdminToken();
    setToken("");
    setAuthState("guest");
    setHint("已退出");
    window.dispatchEvent(new Event("asin-lens-token-saved"));
  }

  function patchAtmosphere(patch: Partial<AtmosphereState>) {
    const touchesScene = Boolean(patch.dayPart || patch.season || patch.weather);
    commitAtmosphere({
      ...atmosphere,
      ...patch,
      mode: touchesScene ? "manual" : (patch.mode ?? atmosphere.mode),
    });
  }

  function restoreAuto() {
    commitAtmosphere({
      mode: "auto",
      useCustomBg: atmosphere.useCustomBg,
      ...resolveAutoAtmosphere(),
    });
  }

  async function handleUploadBackground(file: File) {
    const { objectUrl, meta } = await processCustomBackground(file);
    revokeCustomUrl();
    customUrlRef.current = objectUrl;
    applyCustomBackgroundUrl(objectUrl);
    setCustomMeta(meta);
    commitAtmosphere({
      ...atmosphere,
      useCustomBg: true,
    });
  }

  async function handleClearBackground() {
    await clearCustomBackground();
    revokeCustomUrl();
    applyCustomBackgroundUrl(null);
    setCustomMeta(null);
    commitAtmosphere({
      ...atmosphere,
      useCustomBg: false,
    });
  }

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden">
      <div className="distant-scene" aria-hidden />
      <div className="camp-scene" aria-hidden />
      <WeatherLayer weather={atmosphere.weather} />
      <div
        className="camp-glow bottom-[10%] left-[12%] size-36 bg-[oklch(0.72_0.16_55)]"
        aria-hidden
      />
      <div
        className="ambient-orb right-[-2rem] top-[42%] size-36 bg-[oklch(0.9_0.12_70)] opacity-28"
        aria-hidden
      />

      <SideQuote />

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-6 py-6 sm:px-10 lg:px-12">
        <header className="animate-rise mb-5 flex shrink-0 flex-wrap items-start justify-between gap-6">
          <div className="max-w-lg">
            <p className="brand-mark">asin-lens</p>
            <h1 className="page-kicker mt-3 font-sans text-balance">
              {title ?? "产品调研"}
            </h1>
            <p className="page-principle mt-2">
              {subtitle ??
                "清楚记录，可追溯脉络，可总结过去——行于当下，更好走向未来。"}
            </p>
            <nav className="mt-4 flex flex-wrap gap-5 text-sm">
              <Link
                href="/projects"
                className="font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline"
              >
                项目
              </Link>
              <Link
                href="/reports"
                className="font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline"
              >
                报告
              </Link>
              <Link
                href="/debug"
                className="font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline"
              >
                MCP 调试
              </Link>
              <Link
                href="/rules"
                className="font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline"
              >
                数据规则
              </Link>
            </nav>
          </div>

          {authState === "authed" ? (
            <div className="relative z-20 flex flex-col items-end gap-2">
              <div className="surface-panel flex items-center gap-2.5 rounded-2xl px-3 py-2">
                <div
                  className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  title="已登录管理员"
                >
                  <UserRound className="size-4" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">已登录</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                    onClick={logout}
                  >
                    <LogOut className="size-3" />
                    退出
                  </button>
                </div>
              </div>
              <AtmospherePanel
                state={atmosphere}
                customMeta={customMeta}
                onChange={patchAtmosphere}
                onRestoreAuto={restoreAuto}
                onUploadBackground={handleUploadBackground}
                onClearBackground={handleClearBackground}
              />
            </div>
          ) : (
            <div className="surface-panel w-full max-w-xs shrink-0 rounded-2xl p-4">
              <p className="mb-2 text-sm font-medium">管理员登录</p>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder="ADMIN_TOKEN"
                  value={token}
                  disabled={authState === "checking" || authState === "unknown"}
                  onChange={(event) => setToken(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveToken();
                    }
                  }}
                  aria-label="管理令牌"
                />
                <Button
                  type="button"
                  disabled={authState === "checking" || authState === "unknown"}
                  onClick={() => void saveToken()}
                >
                  {authState === "checking" ? "验证中" : "登录"}
                </Button>
              </div>
              <p
                className={`mt-2 text-xs leading-relaxed ${
                  authState === "invalid"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {hint ||
                  (authState === "unknown"
                    ? "正在检查登录状态…"
                    : "输入令牌后继续")}
              </p>
            </div>
          )}
        </header>

        <div className="animate-rise-delay min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 [scrollbar-width:thin]">
          {children}
        </div>
      </div>
    </div>
  );
}
