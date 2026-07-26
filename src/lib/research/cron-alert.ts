import type { AutoDailyProjectResult } from "@/lib/research/auto-daily";

export type AutoDailyPipelineSummary = {
  reportDate: string;
  projectCount: number;
  outputs: AutoDailyProjectResult[];
};

export type CronFailureIssue = {
  projectName?: string;
  step: string;
  detail: string;
};

/** 从自动日更结果抽出需告警的问题（纯函数，可单测）。 */
export function collectAutoDailyIssues(
  result: AutoDailyPipelineSummary,
): CronFailureIssue[] {
  const issues: CronFailureIssue[] = [];

  if (result.projectCount === 0) {
    issues.push({
      step: "pipeline",
      detail: "无 auto_daily 项目，Cron 未采集/未出报告",
    });
    return issues;
  }

  for (const row of result.outputs) {
    if (!row.collect.ok) {
      issues.push({
        projectName: row.projectName,
        step: "collect",
        detail: row.collect.error ?? "unknown error",
      });
    } else if ((row.collect.failures ?? 0) > 0) {
      issues.push({
        projectName: row.projectName,
        step: "collect",
        detail: `部分 ASIN 失败 failures=${row.collect.failures}`,
      });
    }

    if (!row.daily.ok) {
      issues.push({
        projectName: row.projectName,
        step: "daily",
        detail: row.daily.error ?? "unknown error",
      });
    }

    if (!row.industry.ok) {
      issues.push({
        projectName: row.projectName,
        step: "industry",
        detail: row.industry.error ?? "unknown error",
      });
    }
  }

  return issues;
}

export function formatCronFailureAlert(input: {
  kind: "unauthorized" | "pipeline" | "uncaught";
  reportDate?: string;
  site?: string;
  issues?: CronFailureIssue[];
  error?: string;
}): string {
  const site = input.site ?? "https://asin-lens.tuneyas.com";
  const lines = [`[asin-lens] Cron 失败告警`, `站点: ${site}`];

  if (input.reportDate) lines.push(`报告日: ${input.reportDate}`);
  lines.push(`类型: ${input.kind}`);

  if (input.error) {
    lines.push(`错误: ${truncate(input.error, 400)}`);
  }

  if (input.issues?.length) {
    lines.push(`问题数: ${input.issues.length}`);
    for (const issue of input.issues.slice(0, 12)) {
      const who = issue.projectName ? `${issue.projectName}/` : "";
      lines.push(`- ${who}${issue.step}: ${truncate(issue.detail, 200)}`);
    }
    if (input.issues.length > 12) {
      lines.push(`…另有 ${input.issues.length - 12} 条`);
    }
  }

  return lines.join("\n");
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
