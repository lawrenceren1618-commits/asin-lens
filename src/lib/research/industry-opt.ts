import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getProject, listProjectAsins } from "@/lib/db/queries";
import {
  asinSnapshots,
  industryOptReports,
  type AsinRole,
  type KeywordTrafficRow,
} from "@/lib/db/schema";
import {
  DEFAULT_COMMERCE_RATES,
  parseCommerceRates,
  type CommerceRatesConfig,
} from "@/lib/research/commerce-rates";
import {
  prepareIndustryOptExport,
  type IndustryOptCanonical,
} from "@/lib/research/industry-opt-format";
import { analyzeKeywordTraffic } from "@/lib/research/keyword-traffic";
import { extractTrafficSourceFromRawRefs } from "@/lib/research/traffic-source";
import {
  computeUnitEconomics,
  emptyListingExtras,
  type ListingExtras,
} from "@/lib/research/unit-economics";
import { shanghaiDay } from "@/lib/time";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  }
  return sorted[mid];
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function listingExtrasFromRawRefs(
  rawRefs: Record<string, unknown> | null | undefined,
): ListingExtras {
  const extras = emptyListingExtras();
  const listing = rawRefs?.listingExtras;
  if (!listing || typeof listing !== "object") return extras;
  const row = listing as Record<string, unknown>;
  const delivery = num(row.deliveryPrice as string | number | null);
  extras.deliveryPrice =
    delivery !== null && delivery >= 0 ? delivery : null;
  extras.weight = typeof row.weight === "string" ? row.weight : null;
  extras.pkgWeight = typeof row.pkgWeight === "string" ? row.pkgWeight : null;
  const gram = num(row.pkgWeightGram as string | number | null);
  extras.pkgWeightGram = gram !== null && gram > 0 ? gram : null;
  extras.dimensions =
    typeof row.dimensions === "string" ? row.dimensions : null;
  extras.pkgDimensions =
    typeof row.pkgDimensions === "string" ? row.pkgDimensions : null;
  extras.bsrLabel = typeof row.bsrLabel === "string" ? row.bsrLabel : null;
  extras.nodeLabelPath =
    typeof row.nodeLabelPath === "string" ? row.nodeLabelPath : null;
  extras.fulfillment =
    typeof row.fulfillment === "string" ? row.fulfillment : null;
  const fba = num(row.fbaFees as string | number | null);
  extras.fbaFees = fba !== null && fba >= 0 ? fba : null;
  return extras;
}

async function latestSnapshot(asinId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(asinSnapshots)
    .where(eq(asinSnapshots.asinId, asinId))
    .orderBy(desc(asinSnapshots.snapshotDate))
    .limit(1);
  return row ?? null;
}

function buildSlice(
  asin: {
    asin: string;
    market: string;
    role: AsinRole;
  },
  snap: Awaited<ReturnType<typeof latestSnapshot>>,
  rates: CommerceRatesConfig,
) {
  const keywordTraffic = (snap?.keywordTraffic ?? []) as KeywordTrafficRow[];
  const analysis = analyzeKeywordTraffic(keywordTraffic);
  const trafficSource = extractTrafficSourceFromRawRefs(
    (snap?.rawRefs ?? {}) as Record<string, unknown>,
  );
  const price = num(snap?.price);
  const unitEconomics = computeUnitEconomics({
    title: snap?.title ?? null,
    listingPrice: price,
    extras: listingExtrasFromRawRefs(
      (snap?.rawRefs ?? {}) as Record<string, unknown>,
    ),
    rates,
  });
  return {
    asin: asin.asin,
    market: asin.market,
    role: asin.role,
    title: snap?.title ?? null,
    price,
    traffic: num(snap?.traffic),
    sales: snap?.sales ?? null,
    rank: snap?.rank ?? null,
    trafficPattern: analysis.pattern,
    top3ShareSum: analysis.top3ShareSum,
    trafficSource,
    topKeywords: analysis.keywords,
    unitEconomics,
  };
}

function pricingNote(
  ownPrice: number | null,
  competitorPrices: number[],
  ownUnit: number | null,
  competitorUnits: number[],
): string {
  if (ownPrice === null && ownUnit === null) {
    return "缺少我方价格，无法对比价带。";
  }
  const parts: string[] = [];
  if (ownPrice !== null && competitorPrices.length > 0) {
    const min = Math.min(...competitorPrices);
    const max = Math.max(...competitorPrices);
    const med = median(competitorPrices);
    parts.push(
      `标价 ${ownPrice} vs 竞品 ${min}~${max}（中位 ${med ?? "—"}）`,
    );
  }
  if (ownUnit !== null && competitorUnits.length > 0) {
    const min = Math.min(...competitorUnits);
    const max = Math.max(...competitorUnits);
    const med = median(competitorUnits);
    if (ownUnit < min) {
      parts.push(
        `单个均价 ${ownUnit} 低于竞品 ${min}~${max}（中位 ${med ?? "—"}），可评估提价。`,
      );
    } else if (ownUnit > max) {
      parts.push(
        `单个均价 ${ownUnit} 高于竞品 ${min}~${max}（中位 ${med ?? "—"}），需证明溢价或回调。`,
      );
    } else {
      parts.push(
        `单个均价 ${ownUnit} 落在竞品 ${min}~${max}（中位 ${med ?? "—"}）内。`,
      );
    }
  }
  return parts.length > 0 ? parts.join(" ") : "竞品价格样本不足。";
}

function economicsNote(
  ownUnit: number | null,
  competitorUnits: number[],
  profit: { status: string; value?: number; reason?: string },
): string {
  const bits: string[] = [];
  if (ownUnit !== null && competitorUnits.length > 0) {
    const med = median(competitorUnits);
    if (med !== null) {
      const delta = Number((ownUnit - med).toFixed(2));
      bits.push(
        delta === 0
          ? "单个均价与竞品中位持平"
          : `单个均价相对竞品中位 ${delta > 0 ? "+" : ""}${delta}`,
      );
    }
  }
  if (profit.status === "ok" && typeof profit.value === "number") {
    bits.push(`单件利润粗算约 ${profit.value} USD（扣佣金/配送/FBA/头程；缺项未扣）`);
  } else if (profit.status === "no_result") {
    bits.push(`利润粗算无结果（${profit.reason ?? "数据不足"}）`);
  }
  bits.push("佣金暂按售价 15%；头程按所选模式 CNY/kg（可在规则页改）。");
  return bits.join("。") + "。";
}

function copyNote(ownTitle: string | null, competitorTitles: string[]): string {
  if (!ownTitle) return "缺少我方标题，无法对比文案。";
  const lengths = competitorTitles.map((t) => t.length).filter((n) => n > 0);
  if (lengths.length === 0) {
    return `我方标题长度 ${ownTitle.length}；竞品标题样本不足，仅作留档。`;
  }
  const avg = Math.round(
    lengths.reduce((a, b) => a + b, 0) / lengths.length,
  );
  return `我方标题长度 ${ownTitle.length}，竞品标题均长约 ${avg}。建议核对核心卖点词是否覆盖主要流量词（本轮仅标题层对比）。`;
}

function trafficNote(
  pattern: "concentrated" | "dispersed" | "unknown",
  top3ShareSum: number | null,
): string {
  if (pattern === "dispersed") {
    return "这是分散型流量。深挖留给其它功能区；本报告仅作筛选结论。";
  }
  if (pattern === "concentrated") {
    const pct =
      top3ShareSum === null ? "—" : `${(top3ShareSum * 100).toFixed(1)}%`;
    return `集中型流量（前三词合计 ${pct}）。优先优化前三词转化、竞价与花费效率。`;
  }
  return "流量词份额数据不足，结构未知。";
}

export async function generateIndustryOptReport(
  projectId: string,
  reportDate = shanghaiDay(new Date()),
  ratesInput?: unknown,
) {
  const rates = parseCommerceRates(ratesInput ?? DEFAULT_COMMERCE_RATES);
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");

  const allAsins = await listProjectAsins(projectId);
  const ownAsins = allAsins.filter((row) => row.role === "own");
  const competitors = allAsins.filter((row) => row.role !== "own");

  const competitorSlices = [];
  for (const row of competitors) {
    competitorSlices.push(
      buildSlice(
        { asin: row.asin, market: row.market, role: "competitor" },
        await latestSnapshot(row.id),
        rates,
      ),
    );
  }

  const competitorPrices = competitorSlices
    .map((s) => s.price)
    .filter((p): p is number => p !== null);
  const competitorUnitPrices = competitorSlices
    .map((s) => s.unitEconomics.unitAvgPrice)
    .filter((p): p is number => p !== null);
  const competitorTitles = competitorSlices
    .map((s) => s.title)
    .filter((t): t is string => Boolean(t));

  const mode =
    ownAsins.length > 0 ? ("industry_plus_own" as const) : ("industry" as const);

  const ownOptimizations = [];
  if (mode === "industry_plus_own") {
    for (const row of ownAsins) {
      const snap = await latestSnapshot(row.id);
      const slice = buildSlice(
        { asin: row.asin, market: row.market, role: "own" },
        snap,
        rates,
      );
      ownOptimizations.push({
        asin: row.asin,
        market: row.market,
        manualCvr60d: num(row.manualCvr60d),
        trafficPattern: slice.trafficPattern,
        trafficNote: trafficNote(slice.trafficPattern, slice.top3ShareSum),
        trafficSource: slice.trafficSource,
        pricingNote: pricingNote(
          slice.price,
          competitorPrices,
          slice.unitEconomics.unitAvgPrice,
          competitorUnitPrices,
        ),
        copyNote: copyNote(slice.title, competitorTitles),
        unitEconomics: slice.unitEconomics,
        economicsNote: economicsNote(
          slice.unitEconomics.unitAvgPrice,
          competitorUnitPrices,
          slice.unitEconomics.unitProfitProxyUsd,
        ),
        keywordInsights: slice.topKeywords,
      });
    }
  }

  const candidate: IndustryOptCanonical = {
    projectId: project.id,
    projectName: project.name,
    reportDate,
    mode,
    competitorCount: competitors.length,
    ownCount: ownAsins.length,
    industry: {
      priceMin:
        competitorPrices.length > 0 ? Math.min(...competitorPrices) : null,
      priceMax:
        competitorPrices.length > 0 ? Math.max(...competitorPrices) : null,
      priceMedian: median(competitorPrices),
      unitAvgPriceMin:
        competitorUnitPrices.length > 0
          ? Math.min(...competitorUnitPrices)
          : null,
      unitAvgPriceMax:
        competitorUnitPrices.length > 0
          ? Math.max(...competitorUnitPrices)
          : null,
      unitAvgPriceMedian: median(competitorUnitPrices),
      dispersedAsinCount: competitorSlices.filter(
        (s) => s.trafficPattern === "dispersed",
      ).length,
      concentratedAsinCount: competitorSlices.filter(
        (s) => s.trafficPattern === "concentrated",
      ).length,
      competitors: competitorSlices,
    },
    ...(mode === "industry_plus_own" ? { ownOptimizations } : {}),
  };

  const { report, markdown, verify } = prepareIndustryOptExport(candidate);
  const db = getDb();

  const existing = await db
    .select()
    .from(industryOptReports)
    .where(
      and(
        eq(industryOptReports.projectId, projectId),
        eq(industryOptReports.reportDate, reportDate),
      ),
    )
    .limit(1);

  let saved = existing[0];
  if (saved) {
    const [updated] = await db
      .update(industryOptReports)
      .set({
        mode: report.mode,
        summaryMd: markdown,
        payload: report,
      })
      .where(eq(industryOptReports.id, saved.id))
      .returning();
    saved = updated;
  } else {
    const [created] = await db
      .insert(industryOptReports)
      .values({
        projectId,
        reportDate,
        mode: report.mode,
        summaryMd: markdown,
        payload: report,
      })
      .returning();
    saved = created;
  }

  return {
    report: saved,
    canonical: report,
    markdown,
    verify: { ok: verify.ok, issues: verify.issues },
  };
}
