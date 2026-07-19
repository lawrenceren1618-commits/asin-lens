import { z } from "zod";

export const anomalySchema = z.object({
  asin: z.string().min(1),
  market: z.string().min(1),
  field: z.enum(["price", "traffic", "sales", "rank"]),
  previous: z.union([z.number(), z.string(), z.null()]),
  current: z.union([z.number(), z.string(), z.null()]),
  changePct: z.number().finite().nullable(),
});

export type ReportAnomaly = z.infer<typeof anomalySchema>;

export const reportCanonicalSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  asinCount: z.number().int().nonnegative(),
  anomalies: z.array(anomalySchema),
});

export type ReportCanonical = z.infer<typeof reportCanonicalSchema>;

export type ReportVerifyResult = {
  ok: boolean;
  report: ReportCanonical | null;
  issues: string[];
};

/** 核对：结构完整后再做面向人的格式变换。 */
export function verifyReportCanonical(candidate: unknown): ReportVerifyResult {
  const parsed = reportCanonicalSchema.safeParse(candidate);
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
  for (const [index, item] of report.anomalies.entries()) {
    if (item.changePct === null && item.previous !== null && item.current !== null) {
      issues.push(`anomalies[${index}]: 有前后值但缺少 changePct`);
    }
  }

  return {
    ok: issues.length === 0,
    report,
    issues,
  };
}

/** 用户熟悉格式：Markdown 日报（导出/邮件/飞书共用）。 */
export function formatDailyReportMd(report: ReportCanonical): string {
  const lines = [
    `# ${report.projectName} 日报 ${report.reportDate}`,
    "",
    `监控 ASIN：${report.asinCount}`,
    `异常条数：${report.anomalies.length}`,
    "",
  ];

  if (report.anomalies.length === 0) {
    lines.push("今日无触发阈值的价格/流量异动。");
  } else {
    for (const item of report.anomalies) {
      const pct =
        item.changePct === null ? "—" : `${item.changePct > 0 ? "+" : ""}${item.changePct}%`;
      lines.push(
        `- ${item.asin} (${item.market}) ${item.field}: ${String(item.previous)} → ${String(item.current)} (${pct})`,
      );
    }
  }

  lines.push("", "— asin-lens · 清楚 · 可追溯 · 可总结");
  return lines.join("\n");
}

/**
 * Confirm → format. Fail closed if verify fails.
 */
export function prepareReportExport(candidate: unknown): {
  report: ReportCanonical;
  markdown: string;
  verify: ReportVerifyResult;
} {
  const verify = verifyReportCanonical(candidate);
  if (!verify.ok || !verify.report) {
    throw new Error(
      `报告核对未通过: ${verify.issues.join("; ") || "unknown"}`,
    );
  }
  return {
    report: verify.report,
    markdown: formatDailyReportMd(verify.report),
    verify,
  };
}
