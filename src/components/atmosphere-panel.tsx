"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, CloudSun, ImagePlus, RotateCcw, Trash2 } from "lucide-react";

import {
  DAY_PART_LABEL,
  DAY_PARTS,
  SEASON_LABEL,
  SEASONS,
  WEATHER_LABEL,
  WEATHERS,
  type AtmosphereState,
} from "@/lib/atmosphere";
import type { CustomBgMeta } from "@/lib/custom-bg";

export function AtmospherePanel({
  state,
  customMeta,
  onChange,
  onRestoreAuto,
  onUploadBackground,
  onClearBackground,
}: {
  state: AtmosphereState;
  customMeta: CustomBgMeta | null;
  onChange: (patch: Partial<AtmosphereState>) => void;
  onRestoreAuto: () => void;
  onUploadBackground: (file: File) => Promise<void>;
  onClearBackground: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const collapseTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    };
  }, []);

  function scheduleCollapse() {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => setOpen(false), 700);
  }

  function selectAndShrink(patch: Partial<AtmosphereState>) {
    onChange(patch);
    scheduleCollapse();
  }

  const summary = [
    DAY_PART_LABEL[state.dayPart],
    SEASON_LABEL[state.season],
    WEATHER_LABEL[state.weather],
  ].join(" · ");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await onUploadBackground(file);
      scheduleCollapse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="surface-panel inline-flex max-w-[14rem] items-center gap-2 rounded-full px-3 py-2 text-left text-xs transition hover:bg-accent"
        title="展开氛围设置"
      >
        <CloudSun className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 truncate text-foreground/85">{summary}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="surface-panel w-[15.5rem] rounded-2xl p-3 text-xs shadow-lg animate-rise">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
          <CloudSun className="size-3.5" />
          氛围
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          收起
        </button>
      </div>

      <Field label="时段">
        {DAY_PARTS.map((value) => (
          <Chip
            key={value}
            active={state.dayPart === value}
            onClick={() => selectAndShrink({ mode: "manual", dayPart: value })}
          >
            {DAY_PART_LABEL[value]}
          </Chip>
        ))}
      </Field>

      <Field label="季节">
        {SEASONS.map((value) => (
          <Chip
            key={value}
            active={state.season === value}
            onClick={() => selectAndShrink({ mode: "manual", season: value })}
          >
            {SEASON_LABEL[value]}
          </Chip>
        ))}
      </Field>

      <Field label="天气">
        {WEATHERS.map((value) => (
          <Chip
            key={value}
            active={state.weather === value}
            onClick={() => selectAndShrink({ mode: "manual", weather: value })}
          >
            {WEATHER_LABEL[value]}
          </Chip>
        ))}
      </Field>

      <div className="mt-2 border-t border-foreground/10 pt-2">
        <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
          自定义背景
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-primary-foreground transition disabled:opacity-50"
          >
            <ImagePlus className="size-3" />
            {busy ? "分析中…" : "上传"}
          </button>
          {state.useCustomBg ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onClearBackground()
                  .then(() => scheduleCollapse())
                  .finally(() => setBusy(false));
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="size-3" />
              清除
            </button>
          ) : null}
        </div>
        {customMeta && state.useCustomBg ? (
          <p className="mt-1.5 truncate text-[10px] leading-4 text-muted-foreground">
            {customMeta.name}
          </p>
        ) : null}
        {error ? (
          <p className="mt-1 text-[10px] text-destructive">{error}</p>
        ) : null}
      </div>

      {state.mode === "manual" ? (
        <button
          type="button"
          onClick={() => {
            onRestoreAuto();
            scheduleCollapse();
          }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          恢复自动
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2 py-1 transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
