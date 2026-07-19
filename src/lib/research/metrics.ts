import { z } from "zod";

import {
  firstText,
  isObject,
  normalizeToolResult,
  safeJson,
  type SourceResult,
} from "./normalize";
import {
  DEFAULT_SOURCE_PRIORITY,
  orderForField,
  type MetricField,
  type SourcePriorityConfig,
} from "./source-priority";

/** Canonical metrics stored in Postgres — AI/machine-friendly, stable shape. */
export const snapshotMetricsSchema = z.object({
  title: z.string(),
  price: z.number().finite().nullable(),
  sales: z.number().int().nullable(),
  rank: z.number().int().nullable(),
  cart: z.string(),
  traffic: z.number().finite().nullable(),
  topKeywords: z.array(z.string().min(1)).max(20),
  rawRefs: z.record(z.string(), z.unknown()),
});

export type SnapshotMetrics = z.infer<typeof snapshotMetricsSchema>;

export type MetricsVerifyResult = {
  ok: boolean;
  metrics: SnapshotMetrics | null;
  issues: string[];
  hasSignal: boolean;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,¥￥,%]/g, "").replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function collectKeywords(data: Record<string, unknown>): string[] {
  const keys = [
    "keywords",
    "topKeywords",
    "trafficKeywords",
    "关键词",
    "流量词",
  ];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (isObject(item)) {
            return firstText(item, ["keyword", "关键词", "word", "text"]);
          }
          return "";
        })
        .filter(Boolean)
        .slice(0, 10);
    }
  }
  const single = firstText(data, ["keyword", "关键词"]);
  return single ? [single] : [];
}

function buildPerSourceMaps(sources: SourceResult[]): {
  bySource: Record<string, Record<string, unknown>>;
  perSourceMeta: Record<string, unknown>;
} {
  const bySource: Record<string, Record<string, unknown>> = {};
  const perSourceMeta: Record<string, unknown> = {};

  for (const source of sources) {
    const items = normalizeToolResult(source);
    const bucket: Record<string, unknown> = {};
    for (const item of items) {
      Object.assign(bucket, item.data);
    }
    bySource[source.source] = bucket;
    perSourceMeta[source.source] = {
      tool: source.tool,
      summary: safeJson(source.raw, 3_000),
      fields: Object.keys(bucket).slice(0, 40),
    };
  }

  return { bySource, perSourceMeta };
}

function pickFromSources(
  bySource: Record<string, Record<string, unknown>>,
  order: string[],
  picker: (data: Record<string, unknown>) => unknown,
): unknown {
  for (const name of order) {
    const data = bySource[name];
    if (!data) continue;
    const value = picker(data);
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    return value;
  }
  return null;
}

function fieldOrder(
  config: SourcePriorityConfig,
  field: MetricField,
): string[] {
  return orderForField(config, field);
}

/** Clean MCP payloads into canonical metrics using source priority. */
export function cleanToMetrics(
  sources: SourceResult[],
  priority: SourcePriorityConfig = DEFAULT_SOURCE_PRIORITY,
): SnapshotMetrics {
  const { bySource, perSourceMeta } = buildPerSourceMaps(sources);

  const title = String(
    pickFromSources(bySource, fieldOrder(priority, "title"), (data) =>
      firstText(data, ["title", "productTitle", "标题", "name"]),
    ) ?? "",
  ).trim();

  const price = toNumber(
    pickFromSources(bySource, fieldOrder(priority, "price"), (data) =>
      data.price ?? data.Price ?? data.售价 ?? data.currentPrice,
    ),
  );

  const salesRaw = toNumber(
    pickFromSources(bySource, fieldOrder(priority, "sales"), (data) =>
      data.sales ?? data.units ?? data.销量 ?? data.monthlySales,
    ),
  );

  const rankRaw = toNumber(
    pickFromSources(bySource, fieldOrder(priority, "rank"), (data) =>
      data.rank ?? data.bsr ?? data.排名 ?? data.BSR,
    ),
  );

  const cart = String(
    pickFromSources(bySource, fieldOrder(priority, "cart"), (data) =>
      firstText(data, ["cart", "buyBox", "购物车", "seller"]),
    ) ?? "",
  ).trim();

  const traffic = toNumber(
    pickFromSources(bySource, fieldOrder(priority, "traffic"), (data) =>
      data.traffic ?? data.trafficScore ?? data.流量 ?? data.visits,
    ),
  );

  const keywordSource =
    pickFromSources(bySource, fieldOrder(priority, "topKeywords"), (data) => {
      const list = collectKeywords(data);
      return list.length > 0 ? list : null;
    }) ?? [];

  const topKeywords = Array.isArray(keywordSource)
    ? keywordSource.filter((item): item is string => typeof item === "string")
    : [];

  return {
    title,
    price,
    sales: salesRaw === null ? null : Math.round(salesRaw),
    rank: rankRaw === null ? null : Math.round(rankRaw),
    cart,
    traffic,
    topKeywords,
    rawRefs: {
      sources: perSourceMeta,
      priority,
      cleanedAt: new Date().toISOString(),
    },
  };
}

export function verifyMetrics(candidate: unknown): MetricsVerifyResult {
  const parsed = snapshotMetricsSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      metrics: null,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
      hasSignal: false,
    };
  }

  const metrics = parsed.data;
  const issues: string[] = [];
  const hasSignal =
    Boolean(metrics.title) ||
    metrics.price !== null ||
    metrics.sales !== null ||
    metrics.rank !== null ||
    metrics.traffic !== null ||
    metrics.topKeywords.length > 0;

  if (!hasSignal) {
    issues.push("无有效业务字段（标题/价格/销量/排名/流量/关键词均为空）");
  }
  if (metrics.price !== null && metrics.price < 0) {
    issues.push("价格不能为负");
  }
  if (metrics.sales !== null && metrics.sales < 0) {
    issues.push("销量不能为负");
  }
  if (metrics.rank !== null && metrics.rank < 0) {
    issues.push("排名不能为负");
  }

  return {
    ok: issues.length === 0,
    metrics,
    issues,
    hasSignal,
  };
}

export function prepareMetricsForStorage(
  sources: SourceResult[],
  priority: SourcePriorityConfig = DEFAULT_SOURCE_PRIORITY,
): {
  metrics: SnapshotMetrics;
  verify: MetricsVerifyResult;
} {
  const cleaned = cleanToMetrics(sources, priority);
  const verify = verifyMetrics(cleaned);

  if (!verify.ok || !verify.metrics) {
    const detail = verify.issues.join("; ") || "metrics verify failed";
    throw new Error(`数据清洗/核对未通过: ${detail}`);
  }

  return { metrics: verify.metrics, verify };
}
