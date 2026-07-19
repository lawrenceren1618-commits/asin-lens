import { z } from "zod";

import { isObject, type SourceResult } from "./normalize";

/**
 * Listing 级流量来源（自然 vs 广告渠道）。
 * 真源：Sif `ops_get_listing_traffic_overview`（见 vendor schema）。
 */
export const trafficSourceSchema = z.object({
  status: z.enum(["ok", "no_result"]),
  reason: z.string().optional(),
  totalScore: z.number().finite().nullable(),
  naturalShare: z.number().finite().nullable(),
  adShare: z.number().finite().nullable(),
  channels: z.object({
    sp: z.number().finite().nullable(),
    recSp: z.number().finite().nullable(),
    sb: z.number().finite().nullable(),
    sbv: z.number().finite().nullable(),
  }),
});

export type TrafficSource = z.infer<typeof trafficSourceSchema>;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[%,]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (isObject(value)) {
    return (
      toNumber(value.ratio) ??
      toNumber(value.share) ??
      toNumber(value.score) ??
      toNumber(value.value)
    );
  }
  return null;
}

/** 占比统一为 0–1；分数保留原值 */
function asShare(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n < 0) return null;
  return n;
}

function scoreField(value: unknown): number | null {
  if (isObject(value)) {
    return toNumber(value.score) ?? toNumber(value.value) ?? toNumber(value);
  }
  return toNumber(value);
}

function shareFromScorePair(
  part: unknown,
  total: number | null,
): number | null {
  if (isObject(part)) {
    const ratio = asShare(part.ratio ?? part.share);
    if (ratio !== null) return ratio;
    const score = scoreField(part);
    if (score !== null && total !== null && total > 0) return score / total;
    return null;
  }
  const n = toNumber(part);
  if (n === null) return null;
  if (n <= 1) return n;
  if (total !== null && total > 0) return n / total;
  return asShare(n);
}

function channelShare(
  breakdown: Record<string, unknown> | null,
  key: string,
  adTotal: number | null,
): number | null {
  if (!breakdown) return null;
  const raw = breakdown[key];
  if (raw === undefined) return null;
  if (isObject(raw)) {
    const ratio = asShare(raw.ratio ?? raw.share);
    if (ratio !== null) return ratio;
    const score = scoreField(raw);
    if (score !== null && adTotal !== null && adTotal > 0) return score / adTotal;
    return score;
  }
  const n = toNumber(raw);
  if (n === null) return null;
  if (n <= 1) return n;
  if (adTotal !== null && adTotal > 0) return n / adTotal;
  return n;
}

function emptyNoResult(reason: string): TrafficSource {
  return {
    status: "no_result",
    reason,
    totalScore: null,
    naturalShare: null,
    adShare: null,
    channels: { sp: null, recSp: null, sb: null, sbv: null },
  };
}

/** 从工具原始 payload 抽取流量来源 */
export function parseTrafficSourcePayload(payload: unknown): TrafficSource {
  if (!isObject(payload)) {
    return emptyNoResult("Sif 流量来源载荷无法解析");
  }

  // 可能包在 data / structuredContent 下
  const root = isObject(payload.data)
    ? payload.data
    : isObject(payload.overview) || isObject(payload.adChannelBreakdown)
      ? payload
      : isObject(payload.structuredContent)
        ? (payload.structuredContent as Record<string, unknown>)
        : payload;

  const overview = isObject(root.overview) ? root.overview : root;
  const breakdown = isObject(root.adChannelBreakdown)
    ? root.adChannelBreakdown
    : isObject(overview.adChannelBreakdown)
      ? overview.adChannelBreakdown
      : null;

  const totalScore =
    scoreField(overview.totalScore) ?? scoreField(root.totalScore);

  const naturalShare =
    shareFromScorePair(overview.naturalScore ?? root.naturalScore, totalScore) ??
    asShare(overview.naturalRatio ?? overview.natural_share);
  const adShare =
    shareFromScorePair(overview.adScore ?? root.adScore, totalScore) ??
    asShare(overview.adRatio ?? overview.ad_share);

  const adTotal =
    scoreField(
      isObject(overview.adScore) ? overview.adScore : overview.adScore,
    ) ??
    (adShare !== null && totalScore !== null ? adShare * totalScore : null);

  const channels = {
    sp: channelShare(breakdown, "spScore", adTotal),
    recSp: channelShare(breakdown, "recSpScore", adTotal),
    sb: channelShare(breakdown, "sbScore", adTotal),
    sbv: channelShare(breakdown, "sbvScore", adTotal),
  };

  if (
    naturalShare === null &&
    adShare === null &&
    channels.sp === null &&
    channels.recSp === null &&
    channels.sb === null &&
    channels.sbv === null
  ) {
    return emptyNoResult("Sif 未返回自然/广告流量占比");
  }

  return {
    status: "ok",
    totalScore,
    naturalShare,
    adShare,
    channels,
  };
}

export function extractTrafficSourceFromSources(
  sources: SourceResult[],
): TrafficSource {
  const overview = [...sources]
    .reverse()
    .find((s) => s.tool === "ops_get_listing_traffic_overview");
  if (!overview) {
    return emptyNoResult("未采集 Sif ops_get_listing_traffic_overview");
  }
  return parseTrafficSourcePayload(overview.raw);
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 从已入库 rawRefs 读取（优先结构化字段，其次 summary） */
export function extractTrafficSourceFromRawRefs(
  rawRefs: Record<string, unknown> | null | undefined,
): TrafficSource {
  if (!rawRefs) {
    return emptyNoResult("快照无 rawRefs");
  }

  if (rawRefs.trafficSource !== undefined) {
    const parsed = trafficSourceSchema.safeParse(rawRefs.trafficSource);
    if (parsed.success) return parsed.data;
  }

  const sources = rawRefs.sources;
  if (!isObject(sources)) {
    return emptyNoResult("快照无流量来源数据");
  }

  const sif = sources.Sif;
  if (!isObject(sif)) {
    return emptyNoResult("快照无 Sif 流量来源");
  }

  if (typeof sif.summary === "string" && sif.summary.trim()) {
    const json = tryParseJson(sif.summary);
    if (json !== null) {
      const result = parseTrafficSourcePayload(json);
      if (result.status === "ok") return result;
      // summary 可能是 keyword 工具的截断；再试 fields 提示
    }
  }

  // 合并桶里可能已有 overview 字段
  if (isObject(sif.overview) || sif.naturalScore !== undefined) {
    return parseTrafficSourcePayload(sif);
  }

  return emptyNoResult("Sif 流量来源无结果或未写入快照");
}

function pct(share: number | null): string {
  if (share === null) return "—";
  return `${(share * 100).toFixed(1)}%`;
}

/** 报告用一行摘要 */
export function formatTrafficSourceLine(source: TrafficSource): string {
  if (source.status === "no_result") {
    return `无结果（${source.reason ?? "无流量来源数据"}）`;
  }
  const ch = source.channels;
  return [
    `自然 ${pct(source.naturalShare)}`,
    `广告 ${pct(source.adShare)}`,
    `（SP ${pct(ch.sp)} · SP推荐 ${pct(ch.recSp)} · SB ${pct(ch.sb)} · SBV ${pct(ch.sbv)}）`,
  ].join(" · ");
}
