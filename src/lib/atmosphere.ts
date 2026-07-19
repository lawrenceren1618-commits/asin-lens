import {
  applyInkTokens,
  clearInkOverrides,
  type InkMode,
} from "@/lib/ink-scheme";
import {
  applyCustomBackgroundUrl,
  readCustomBgMeta,
} from "@/lib/custom-bg";

const STORAGE_KEY = "asin-lens-atmosphere-v2";

export type DayPart = "dawn" | "day" | "dusk";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "clear" | "rain" | "snow" | "leaves";
export type AtmosphereMode = "auto" | "manual";

export type AtmosphereState = {
  mode: AtmosphereMode;
  dayPart: DayPart;
  season: Season;
  weather: Weather;
  useCustomBg: boolean;
};

export const DAY_PART_LABEL: Record<DayPart, string> = {
  dawn: "晨光",
  day: "日中",
  dusk: "暮色",
};

export const SEASON_LABEL: Record<Season, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

export const WEATHER_LABEL: Record<Weather, string> = {
  clear: "晴朗",
  rain: "落雨",
  snow: "落雪",
  leaves: "落叶",
};

const DAY_PARTS: DayPart[] = ["dawn", "day", "dusk"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
const WEATHERS: Weather[] = ["clear", "rain", "snow", "leaves"];

function isDayPart(value: unknown): value is DayPart {
  return typeof value === "string" && DAY_PARTS.includes(value as DayPart);
}

function isSeason(value: unknown): value is Season {
  return typeof value === "string" && SEASONS.includes(value as Season);
}

function isWeather(value: unknown): value is Weather {
  return typeof value === "string" && WEATHERS.includes(value as Weather);
}

export function inferDayPart(date = new Date()): DayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "dawn";
  if (hour >= 11 && hour < 17) return "day";
  return "dusk";
}

export function inferSeason(date = new Date()): Season {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function inferWeather(date = new Date(), season = inferSeason(date)): Weather {
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const roll = seed % 10;

  if (season === "winter") {
    if (roll < 4) return "snow";
    if (roll < 7) return "clear";
    return "rain";
  }
  if (season === "autumn") {
    if (roll < 4) return "leaves";
    if (roll < 7) return "clear";
    if (roll < 9) return "rain";
    return "snow";
  }
  if (season === "spring") {
    if (roll < 5) return "clear";
    if (roll < 8) return "rain";
    return "leaves";
  }
  if (roll < 6) return "clear";
  if (roll < 9) return "rain";
  return "leaves";
}

export function resolveAutoAtmosphere(date = new Date()): Omit<
  AtmosphereState,
  "mode" | "useCustomBg"
> {
  const season = inferSeason(date);
  return {
    dayPart: inferDayPart(date),
    season,
    weather: inferWeather(date, season),
  };
}

export function defaultAtmosphere(): AtmosphereState {
  return {
    mode: "auto",
    useCustomBg: Boolean(readCustomBgMeta()),
    ...resolveAutoAtmosphere(),
  };
}

/**
 * Ink is design-fixed, never user-picked.
 * Clear upper reading band → dark ink for built-in schemes.
 * Custom photo → from luminance analysis.
 */
export function resolveEffectiveInk(state: AtmosphereState): InkMode {
  if (state.useCustomBg) {
    const meta = readCustomBgMeta();
    if (meta) return meta.ink;
  }
  // Upper sky is always designed clear → dark ink for effortless reading
  return "dark";
}

export function readStoredAtmosphere(): AtmosphereState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("asin-lens-atmosphere-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AtmosphereState>;
    if (parsed.mode !== "auto" && parsed.mode !== "manual") return null;
    if (!isDayPart(parsed.dayPart) || !isSeason(parsed.season) || !isWeather(parsed.weather)) {
      return null;
    }
    return {
      mode: parsed.mode,
      dayPart: parsed.dayPart,
      season: parsed.season,
      weather: parsed.weather,
      useCustomBg:
        typeof parsed.useCustomBg === "boolean"
          ? parsed.useCustomBg
          : Boolean(readCustomBgMeta()),
    };
  } catch {
    return null;
  }
}

export function writeStoredAtmosphere(state: AtmosphereState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function applyAtmosphereToDocument(state: AtmosphereState) {
  const root = document.documentElement;
  root.dataset.day = state.dayPart;
  root.dataset.season = state.season;
  root.dataset.weather = state.weather;
  root.dataset.atmosphere = state.mode;
  root.dataset.bgSource = state.useCustomBg ? "custom" : "builtin";

  clearInkOverrides();
  applyInkTokens(resolveEffectiveInk(state));

  if (!state.useCustomBg) {
    applyCustomBackgroundUrl(null);
  }
}

export function getEffectiveAtmosphere(): AtmosphereState {
  const stored = readStoredAtmosphere();
  if (!stored) return defaultAtmosphere();
  if (stored.mode === "auto") {
    return {
      mode: "auto",
      useCustomBg: stored.useCustomBg && Boolean(readCustomBgMeta()),
      ...resolveAutoAtmosphere(),
    };
  }
  return {
    ...stored,
    useCustomBg: stored.useCustomBg && Boolean(readCustomBgMeta()),
  };
}

export function cycleWeather(current: Weather): Weather {
  const index = WEATHERS.indexOf(current);
  return WEATHERS[(index + 1) % WEATHERS.length];
}

export { DAY_PARTS, SEASONS, WEATHERS };
