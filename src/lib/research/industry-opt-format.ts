import { z } from "zod";

import {
  formatMetricAvailability,
  TOP3_CONCENTRATION_THRESHOLD,
} from "./keyword-traffic";
import {
  formatTrafficSourceLine,
  trafficSourceSchema,
} from "./traffic-source";

const metricAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), value: z.number().finite() }),
  z.object({ status: z.literal("no_result"), reason: z.string().min(1) }),
]);

const keywordInsightSchema = z.object({
  keyword: z.string().min(1),
  share: z.number().finite().nullable(),
  dailyTraffic: z.number().finite().nullable(),
  source: z.enum(["Sif", "SellerSprite"]),
  cvr: metricAvailabilitySchema,
  bid: metricAvailabilitySchema,
  spend: metricAvailabilitySchema,
});

const asinIndustrySliceSchema = z.object({
  asin: z.string().min(1),
  market: z.string().min(1),
  role: z.enum(["own", "competitor"]),
  title: z.string().nullable(),
  price: z.number().finite().nullable(),
  traffic: z.number().finite().nullable(),
  sales: z.number().int().nullable(),
  rank: z.number().int().nullable(),
  trafficPattern: z.enum(["concentrated", "dispersed", "unknown"]),
  top3ShareSum: z.number().finite().nullable(),
  trafficSource: trafficSourceSchema,
  topKeywords: z.array(keywordInsightSchema),
});

const ownOptimizationSchema = z.object({
  asin: z.string().min(1),
  market: z.string().min(1),
  manualCvr60d: z.number().finite().nullable(),
  trafficPattern: z.enum(["concentrated", "dispersed", "unknown"]),
  trafficNote: z.string(),
  trafficSource: trafficSourceSchema,
  pricingNote: z.string(),
  copyNote: z.string(),
  keywordInsights: z.array(keywordInsightSchema),
});

export const industryOptCanonicalSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["industry", "industry_plus_own"]),
  competitorCount: z.number().int().nonnegative(),
  ownCount: z.number().int().nonnegative(),
  industry: z.object({
    priceMin: z.number().finite().nullable(),
    priceMax: z.number().finite().nullable(),
    priceMedian: z.number().finite().nullable(),
    dispersedAsinCount: z.number().int().nonnegative(),
    concentratedAsinCount: z.number().int().nonnegative(),
    competitors: z.array(asinIndustrySliceSchema),
  }),
  ownOptimizations: z.array(ownOptimizationSchema).optional(),
});

export type IndustryOptCanonical = z.infer<typeof industryOptCanonicalSchema>;

export type IndustryOptVerifyResult = {
  ok: boolean;
  report: IndustryOptCanonical | null;
  issues: string[];
};

export function verifyIndustryOptCanonical(
  candidate: unknown,
): IndustryOptVerifyResult {
  const parsed = industryOptCanonicalSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      report: null,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
    };
  }

  const report = parsed.data;
  const issues: string[] = [];
  if (report.mode === "industry" && report.ownCount > 0) {
    issues.push("mode=industry 但 ownCount>0");
  }
  if (report.mode === "industry_plus_own" && report.ownCount === 0) {
    issues.push("mode=industry_plus_own 但 ownCount=0");
  }
  if (
    report.mode === "industry_plus_own" &&
    (!report.ownOptimizations || report.ownOptimizations.length === 0)
  ) {
    issues.push("industry_plus_own 缺少 ownOptimizations");
  }

  return {
    ok: issues.length === 0,
    report,
    issues,
  };
}

function pct(share: number | null): string {
  if (share === null) return "—";
  return `${(share * 100).toFixed(1)}%`;
}

function patternLabel(
  pattern: "concentrated" | "dispersed" | "unknown",
): string {
  if (pattern === "concentrated") return "集中型（前三词≥70%）";
  if (pattern === "dispersed") return "分散型流量";
  return "流量结构未知";
}

export function formatIndustryOptMd(report: IndustryOptCanonical): string {
  const lines = [
    `# ${report.projectName} 行业/优化报告 ${report.reportDate}`,
    "",
    `模式：${report.mode === "industry" ? "行业竞品报告" : "行业报告 + 我方可优化"}`,
    `竞品 ASIN：${report.competitorCount} · 我的 ASIN：${report.ownCount}`,
    "",
    "## 行业概览",
    "",
    `- 价带：${report.industry.priceMin ?? "—"} ~ ${report.industry.priceMax ?? "—"}（中位 ${report.industry.priceMedian ?? "—"}）`,
    `- 集中型流量：${report.industry.concentratedAsinCount} · 分散型流量：${report.industry.dispersedAsinCount}`,
    `- 判定阈值：前三词合计份额 ≥ ${TOP3_CONCENTRATION_THRESHOLD * 100}% 为集中型；否则直接标「分散型流量」（深挖留待其它功能区）`,
    "",
  ];

  for (const item of report.industry.competitors) {
    lines.push(
      `### 竞品 ${item.asin} (${item.market})`,
      `- 标题：${item.title || "—"}`,
      `- 价格 / 流量 / 销量 / 排名：${item.price ?? "—"} / ${item.traffic ?? "—"} / ${item.sales ?? "—"} / ${item.rank ?? "—"}`,
      `- 流量结构：${patternLabel(item.trafficPattern)}${item.top3ShareSum !== null ? `（前三合计 ${pct(item.top3ShareSum)}）` : ""}`,
      `- 流量来源：${formatTrafficSourceLine(item.trafficSource)}`,
    );
    if (item.trafficPattern === "dispersed") {
      lines.push("- 结论：这是分散型流量（不在此报告深挖）");
    }
    const top = item.topKeywords.slice(0, 5);
    if (top.length > 0) {
      lines.push("- 主要流量词：");
      for (const kw of top) {
        lines.push(
          `  - ${kw.keyword} · 份额 ${pct(kw.share)} · 日均 ${kw.dailyTraffic ?? "—"} · 转化 ${formatMetricAvailability(kw.cvr)}`,
        );
      }
    }
    lines.push("");
  }

  if (report.mode === "industry_plus_own" && report.ownOptimizations) {
    lines.push("## 我方可优化", "");
    for (const own of report.ownOptimizations) {
      const cvrBaseline =
        own.manualCvr60d === null
          ? "未提供（词级转化无源时无法对照）"
          : `${own.manualCvr60d}%（整体基准；Sif 无 ASIN×词转化，词行仅作旁注对照）`;
      lines.push(
        `### 我的 ASIN ${own.asin} (${own.market})`,
        `- 近 60 天整体转化率基准（手填）：${cvrBaseline}`,
        `- 流量：${own.trafficNote}`,
        `- 流量来源：${formatTrafficSourceLine(own.trafficSource)}`,
        `- 定价：${own.pricingNote}`,
        `- 文案：${own.copyNote}`,
        "- 主要流量词（词转化无源则无结果；有手填基准时可对照整体 CVR）：",
      );
      for (const kw of own.keywordInsights.slice(0, 8)) {
        const cvrNote =
          kw.cvr.status === "no_result" && own.manualCvr60d !== null
            ? `${formatMetricAvailability(kw.cvr)}；对照手填整体 ${own.manualCvr60d}%`
            : formatMetricAvailability(kw.cvr);
        lines.push(
          `  - ${kw.keyword} · 份额 ${pct(kw.share)} · 日均 ${kw.dailyTraffic ?? "—"} · 转化 ${cvrNote} · 竞价 ${formatMetricAvailability(kw.bid)} · 花费 ${formatMetricAvailability(kw.spend)}`,
        );
      }
      lines.push("");
    }
  }

  lines.push("— asin-lens · 清楚 · 可追溯 · 可总结");
  return lines.join("\n");
}

export function prepareIndustryOptExport(candidate: unknown): {
  report: IndustryOptCanonical;
  markdown: string;
  verify: IndustryOptVerifyResult;
} {
  const verify = verifyIndustryOptCanonical(candidate);
  if (!verify.ok || !verify.report) {
    throw new Error(
      `行业/优化报告核对未通过: ${verify.issues.join("; ") || "unknown"}`,
    );
  }
  return {
    report: verify.report,
    markdown: formatIndustryOptMd(verify.report),
    verify,
  };
}
