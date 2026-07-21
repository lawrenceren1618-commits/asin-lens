import { z } from "zod";

/** Built-in MCP sources; users may add custom labels for future sources. */
export const BUILTIN_SOURCES = ["SellerSprite", "Sif"] as const;

export type BuiltinSource = (typeof BUILTIN_SOURCES)[number];

export const METRIC_FIELDS = [
  "title",
  "price",
  "sales",
  "rank",
  "cart",
  "traffic",
  "topKeywords",
] as const;

export type MetricField = (typeof METRIC_FIELDS)[number];

/** 流量相关：冲突时 Sif 优先（含 keywordTraffic / trafficSource 管线） */
export const TRAFFIC_METRIC_FIELDS = ["traffic", "topKeywords"] as const;

export type TrafficMetricField = (typeof TRAFFIC_METRIC_FIELDS)[number];

export const sourcePrioritySchema = z.object({
  /** Global order: earlier source wins when field has no override */
  order: z.array(z.string().min(1).max(40)).min(1).max(12),
  /** Optional per-field order; empty/omitted → use global order */
  fields: z
    .record(z.string(), z.array(z.string().min(1).max(40)).min(1).max(12))
    .optional(),
});

export type SourcePriorityConfig = z.infer<typeof sourcePrioritySchema>;

/** 产品默认：非流量 SellerSprite 优先；流量字段 Sif 优先 */
export const DEFAULT_SOURCE_PRIORITY: SourcePriorityConfig = {
  order: ["SellerSprite", "Sif"],
  fields: {
    traffic: ["Sif", "SellerSprite"],
    topKeywords: ["Sif", "SellerSprite"],
  },
};

function cloneDefaultPriority(): SourcePriorityConfig {
  return {
    order: [...DEFAULT_SOURCE_PRIORITY.order],
    fields: { ...DEFAULT_SOURCE_PRIORITY.fields },
  };
}

export function parseSourcePriority(value: unknown): SourcePriorityConfig {
  const parsed = sourcePrioritySchema.safeParse(value);
  if (!parsed.success) return cloneDefaultPriority();
  const order = dedupeNames(parsed.data.order);
  if (order.length === 0) return cloneDefaultPriority();
  const fields: SourcePriorityConfig["fields"] = {};
  if (parsed.data.fields) {
    for (const [key, list] of Object.entries(parsed.data.fields)) {
      const cleaned = dedupeNames(list);
      if (cleaned.length > 0) fields[key] = cleaned;
    }
  }
  return { order, fields };
}

function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function orderForField(
  config: SourcePriorityConfig,
  field: MetricField,
): string[] {
  const override = config.fields?.[field];
  if (override && override.length > 0) return override;
  return config.order;
}

export const FIELD_LABEL: Record<MetricField, string> = {
  title: "标题",
  price: "价格",
  sales: "销量",
  rank: "排名",
  cart: "购物车/卖家",
  traffic: "流量",
  topKeywords: "关键词",
};
