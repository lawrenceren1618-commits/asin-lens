/** Ink schemes are design-fixed from atmosphere / image analysis — never user-picked. */

export type InkMode = "light" | "dark";

export type InkTokens = {
  foreground: string;
  mutedForeground: string;
  quote: string;
  panel: string;
  card: string;
  titleShadow: string;
  scrim: string;
  brand: string;
};

/** Light text — only when custom photo is truly dark */
export const INK_LIGHT: InkTokens = {
  foreground: "oklch(0.97 0.01 75)",
  mutedForeground: "oklch(0.84 0.02 70)",
  quote: "oklch(0.92 0.03 70)",
  panel: "oklch(0.2 0.03 55 / 0.78)",
  card: "oklch(0.22 0.03 55 / 0.75)",
  titleShadow: "0 1px 16px oklch(0.1 0.03 255 / 0.45)",
  scrim: "oklch(0.14 0.03 255 / 0.55)",
  brand: "oklch(0.98 0.015 75)",
};

/** Dark text — default for clear upper reading band */
export const INK_DARK: InkTokens = {
  foreground: "oklch(0.24 0.03 55)",
  mutedForeground: "oklch(0.4 0.03 55)",
  quote: "oklch(0.34 0.04 50)",
  panel: "oklch(0.995 0.006 75 / 0.9)",
  card: "oklch(0.995 0.006 75 / 0.92)",
  titleShadow: "none",
  scrim: "oklch(0.995 0.006 75 / 0.78)",
  brand: "oklch(0.22 0.045 45)",
};

export function inkForDayPart(_dayPart: "dawn" | "day" | "dusk"): InkMode {
  // Built-in schemes keep a clear upper band → always dark ink
  return "dark";
}

export function luminanceFromRgb(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function inkFromLuminance(luma: number): InkMode {
  return luma >= 0.45 ? "dark" : "light";
}

export function applyInkTokens(mode: InkMode) {
  const tokens = mode === "dark" ? INK_DARK : INK_LIGHT;
  const root = document.documentElement;
  root.dataset.ink = mode;
  root.style.setProperty("--foreground", tokens.foreground);
  root.style.setProperty("--card-foreground", tokens.foreground);
  root.style.setProperty("--muted-foreground", tokens.mutedForeground);
  root.style.setProperty("--quote", tokens.quote);
  root.style.setProperty("--panel", tokens.panel);
  root.style.setProperty("--card", tokens.card);
  root.style.setProperty("--title-shadow", tokens.titleShadow);
  root.style.setProperty("--text-scrim", tokens.scrim);
  root.style.setProperty("--brand", tokens.brand);
}

export function clearInkOverrides() {
  const root = document.documentElement;
  const keys = [
    "--foreground",
    "--card-foreground",
    "--muted-foreground",
    "--quote",
    "--panel",
    "--card",
    "--title-shadow",
    "--text-scrim",
    "--brand",
  ];
  for (const key of keys) root.style.removeProperty(key);
}
