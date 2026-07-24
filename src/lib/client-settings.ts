import type { SourcePriorityConfig } from "@/lib/research/source-priority";
import {
  DEFAULT_SOURCE_PRIORITY,
  parseSourcePriority,
} from "@/lib/research/source-priority";
import {
  DEFAULT_COMMERCE_RATES,
  parseCommerceRates,
  type CommerceRatesConfig,
} from "@/lib/research/commerce-rates";

/** v2：默认「流量 Sif / 其余 SS」；旧 v1 键忽略，避免沿用无字段覆盖的旧配置 */
const PRIORITY_KEY = "asin-lens-source-priority-v2";
const RESOLVED_ISSUES_KEY = "asin-lens-resolved-issues-v1";
const COMMERCE_RATES_KEY = "asin-lens-commerce-rates-v1";

export function loadSourcePriority(): SourcePriorityConfig {
  if (typeof window === "undefined") return DEFAULT_SOURCE_PRIORITY;
  try {
    const raw = localStorage.getItem(PRIORITY_KEY);
    if (!raw) return DEFAULT_SOURCE_PRIORITY;
    return parseSourcePriority(JSON.parse(raw));
  } catch {
    return DEFAULT_SOURCE_PRIORITY;
  }
}

export function saveSourcePriority(config: SourcePriorityConfig) {
  localStorage.setItem(
    PRIORITY_KEY,
    JSON.stringify(parseSourcePriority(config)),
  );
}

export function loadCommerceRates(): CommerceRatesConfig {
  const fresh = (): CommerceRatesConfig => ({
    ...DEFAULT_COMMERCE_RATES,
    firstMileRatesCnyPerKg: {
      ...DEFAULT_COMMERCE_RATES.firstMileRatesCnyPerKg,
    },
  });
  if (typeof window === "undefined") return fresh();
  try {
    const raw = localStorage.getItem(COMMERCE_RATES_KEY);
    if (!raw) return fresh();
    return parseCommerceRates(JSON.parse(raw));
  } catch {
    return fresh();
  }
}

export function saveCommerceRates(config: CommerceRatesConfig) {
  localStorage.setItem(
    COMMERCE_RATES_KEY,
    JSON.stringify(parseCommerceRates(config)),
  );
}

export function loadResolvedIssueIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(RESOLVED_ISSUES_KEY);
    if (!raw) return new Set();
    const list = JSON.parse(raw) as string[];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function saveResolvedIssueIds(ids: Set<string>) {
  localStorage.setItem(RESOLVED_ISSUES_KEY, JSON.stringify([...ids]));
}
