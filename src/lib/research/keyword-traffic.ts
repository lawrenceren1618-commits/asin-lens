import { z } from "zod";

import { firstText, isObject } from "./normalize";

/** 词日均流量辅助阈值：低于此值则转化/竞价/花费标为无结果 */
export const KEYWORD_DAILY_TRAFFIC_MIN = 50;

/** 前三词合计份额 ≥ 此值视为集中型流量 */
export const TOP3_CONCENTRATION_THRESHOLD = 0.7;

export const keywordTrafficRowSchema = z.object({
  keyword: z.string().min(1),
  share: z.number().finite().nullable(),
  dailyTraffic: z.number().finite().nullable(),
  cvr: z.number().finite().nullable(),
  bid: z.number().finite().nullable(),
  spend: z.number().finite().nullable(),
  source: z.enum(["Sif", "SellerSprite"]),
});

export type KeywordTrafficRow = z.infer<typeof keywordTrafficRowSchema>;

export type MetricAvailability =
  | { status: "ok"; value: number }
  | { status: "no_result"; reason: string };

export type TrafficPattern = "concentrated" | "dispersed" | "unknown";

export type KeywordInsight = {
  keyword: string;
  share: number | null;
  dailyTraffic: number | null;
  source: "Sif" | "SellerSprite";
  cvr: MetricAvailability;
  bid: MetricAvailability;
  spend: MetricAvailability;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,¥￥,%]/g, "").replace(/,/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** share 可能是 0–1 或 0–100；统一为 0–1 */
function normalizeShare(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n < 0) return null;
  return n;
}

function listKeywordArrays(data: Record<string, unknown>): unknown[] {
  const keys = [
    "keywords",
    "topKeywords",
    "trafficKeywords",
    "keywordList",
    "trafficSources",
    "关键词",
    "流量词",
    "流量来源",
  ];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function parseKeywordItem(
  item: unknown,
  source: "Sif" | "SellerSprite",
): KeywordTrafficRow | null {
  if (typeof item === "string") {
    const keyword = item.trim();
    if (!keyword) return null;
    return {
      keyword,
      share: null,
      dailyTraffic: null,
      cvr: null,
      bid: null,
      spend: null,
      source,
    };
  }
  if (!isObject(item)) return null;

  const keyword = firstText(item, [
    "keyword",
    "关键词",
    "word",
    "text",
    "query",
    "searchTerm",
    "name",
  ]);
  if (!keyword) return null;

  return {
    keyword: keyword.trim(),
    share: normalizeShare(
      item.share ??
        item.trafficShare ??
        item.占比 ??
        item.trafficPercent ??
        item.percent ??
        item.ratio,
    ),
    dailyTraffic: toNumber(
      item.dailyTraffic ??
        item.traffic ??
        item.avgTraffic ??
        item.日均流量 ??
        item.searches ??
        item.volume,
    ),
    cvr: toNumber(
      item.cvr ??
        item.conversionRate ??
        item.转化率 ??
        item.convRate ??
        item.cr,
    ),
    bid: toNumber(
      item.bid ?? item.竞价 ?? item.cpc ?? item.suggestedBid ?? item.bidPrice,
    ),
    spend: toNumber(
      item.spend ?? item.花费 ?? item.cost ?? item.adSpend ?? item.adCost,
    ),
    source,
  };
}

function extractFromSource(
  data: Record<string, unknown> | undefined,
  source: "Sif" | "SellerSprite",
): KeywordTrafficRow[] {
  if (!data) return [];
  return listKeywordArrays(data)
    .map((item) => parseKeywordItem(item, source))
    .filter((row): row is KeywordTrafficRow => row !== null)
    .slice(0, 30);
}

/**
 * Sif 优先合并词表。
 * - share / dailyTraffic / bid / spend：Sif 优先，SellerSprite 补缺
 * - cvr：只用 Sif（卖家精灵转化不进规范指标）
 */
export function mergeKeywordTraffic(
  bySource: Record<string, Record<string, unknown>>,
): KeywordTrafficRow[] {
  const sifRows = extractFromSource(bySource.Sif, "Sif");
  const ssRows = extractFromSource(bySource.SellerSprite, "SellerSprite");

  const map = new Map<string, KeywordTrafficRow>();

  for (const row of ssRows) {
    map.set(row.keyword.toLowerCase(), {
      ...row,
      cvr: null, // 转化率不以卖家精灵为准
    });
  }

  for (const row of sifRows) {
    const key = row.keyword.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row });
      continue;
    }
    map.set(key, {
      keyword: row.keyword,
      share: row.share ?? prev.share,
      dailyTraffic: row.dailyTraffic ?? prev.dailyTraffic,
      cvr: row.cvr, // 仅 Sif；无则保持 null
      bid: row.bid ?? prev.bid,
      spend: row.spend ?? prev.spend,
      source: "Sif",
    });
  }

  const rows = [...map.values()];
  rows.sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  return rows.slice(0, 20);
}

function availabilityFromSifFirst(
  value: number | null,
  dailyTraffic: number | null,
  label: string,
): MetricAvailability {
  if (value === null) {
    return { status: "no_result", reason: `Sif 未返回该词${label}` };
  }
  if (dailyTraffic !== null && dailyTraffic < KEYWORD_DAILY_TRAFFIC_MIN) {
    return {
      status: "no_result",
      reason: `词日均流量 < ${KEYWORD_DAILY_TRAFFIC_MIN}，${label}不可信`,
    };
  }
  return { status: "ok", value };
}

function availabilityOptionalSource(
  value: number | null,
  dailyTraffic: number | null,
  label: string,
): MetricAvailability {
  if (value === null) {
    return { status: "no_result", reason: `无源数据，无法给出${label}` };
  }
  if (dailyTraffic !== null && dailyTraffic < KEYWORD_DAILY_TRAFFIC_MIN) {
    return {
      status: "no_result",
      reason: `词日均流量 < ${KEYWORD_DAILY_TRAFFIC_MIN}，${label}不可信`,
    };
  }
  return { status: "ok", value };
}

export function analyzeKeywordTraffic(
  rows: KeywordTrafficRow[],
): {
  pattern: TrafficPattern;
  top3ShareSum: number | null;
  keywords: KeywordInsight[];
} {
  if (rows.length === 0) {
    return { pattern: "unknown", top3ShareSum: null, keywords: [] };
  }

  const withShare = rows.filter((r) => r.share !== null);
  const top3 = [...rows]
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
    .slice(0, 3);
  const top3ShareSum =
    withShare.length > 0
      ? top3.reduce((sum, r) => sum + (r.share ?? 0), 0)
      : null;

  let pattern: TrafficPattern = "unknown";
  if (top3ShareSum !== null) {
    pattern =
      top3ShareSum >= TOP3_CONCENTRATION_THRESHOLD
        ? "concentrated"
        : "dispersed";
  }

  const keywords: KeywordInsight[] = rows.map((row) => ({
    keyword: row.keyword,
    share: row.share,
    dailyTraffic: row.dailyTraffic,
    source: row.source,
    cvr: availabilityFromSifFirst(row.cvr, row.dailyTraffic, "转化率"),
    bid: availabilityOptionalSource(row.bid, row.dailyTraffic, "竞价"),
    spend: availabilityOptionalSource(row.spend, row.dailyTraffic, "花费"),
  }));

  return { pattern, top3ShareSum, keywords };
}

export function formatMetricAvailability(metric: MetricAvailability): string {
  if (metric.status === "ok") return String(metric.value);
  return `无结果（${metric.reason}）`;
}
