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
  prepareIndustryOptExport,
  type IndustryOptCanonical,
} from "@/lib/research/industry-opt-format";
import { analyzeKeywordTraffic } from "@/lib/research/keyword-traffic";
import { extractTrafficSourceFromRawRefs } from "@/lib/research/traffic-source";
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
) {
  const keywordTraffic = (snap?.keywordTraffic ?? []) as KeywordTrafficRow[];
  const analysis = analyzeKeywordTraffic(keywordTraffic);
  const trafficSource = extractTrafficSourceFromRawRefs(
    (snap?.rawRefs ?? {}) as Record<string, unknown>,
  );
  return {
    asin: asin.asin,
    market: asin.market,
    role: asin.role,
    title: snap?.title ?? null,
    price: num(snap?.price),
    traffic: num(snap?.traffic),
    sales: snap?.sales ?? null,
    rank: snap?.rank ?? null,
    trafficPattern: analysis.pattern,
    top3ShareSum: analysis.top3ShareSum,
    trafficSource,
    topKeywords: analysis.keywords,
  };
}

function pricingNote(
  ownPrice: number | null,
  competitorPrices: number[],
): string {
  if (ownPrice === null) return "缺少我方价格，无法对比价带。";
  if (competitorPrices.length === 0) return "竞品无价格样本，无法给出定价建议。";
  const min = Math.min(...competitorPrices);
  const max = Math.max(...competitorPrices);
  const med = median(competitorPrices);
  if (med === null) return "竞品价带不足。";
  if (ownPrice < min) {
    return `我方价格 ${ownPrice} 低于竞品价带 ${min}~${max}（中位 ${med}），可评估提价空间与转化影响。`;
  }
  if (ownPrice > max) {
    return `我方价格 ${ownPrice} 高于竞品价带 ${min}~${max}（中位 ${med}），需用转化/文案证明溢价，或回调至价带内。`;
  }
  return `我方价格 ${ownPrice} 落在竞品价带 ${min}~${max}（中位 ${med}）内，可继续观察词转化与广告花费效率。`;
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
) {
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
      ),
    );
  }

  const competitorPrices = competitorSlices
    .map((s) => s.price)
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
      );
      ownOptimizations.push({
        asin: row.asin,
        market: row.market,
        manualCvr60d: num(row.manualCvr60d),
        trafficPattern: slice.trafficPattern,
        trafficNote: trafficNote(slice.trafficPattern, slice.top3ShareSum),
        trafficSource: slice.trafficSource,
        pricingNote: pricingNote(slice.price, competitorPrices),
        copyNote: copyNote(slice.title, competitorTitles),
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
      dispersedAsinCount: competitorSlices.filter(
        (s) => s.trafficPattern === "dispersed",
      ).length,
      concentratedAsinCount: competitorSlices.filter(
        (s) => s.trafficPattern === "concentrated",
      ).length,
      competitors: competitorSlices,
    },
    ...(mode === "industry_plus_own"
      ? { ownOptimizations }
      : {}),
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
