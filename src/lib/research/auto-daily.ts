import "server-only";

import { listAutoDailyProjects } from "@/lib/db/queries";
import { sendReportEmail } from "@/lib/notify/email";
import { sendFeishuWebhook } from "@/lib/notify/feishu";
import { collectProject } from "@/lib/research/collect";
import { DEFAULT_COMMERCE_RATES } from "@/lib/research/commerce-rates";
import { generateIndustryOptReport } from "@/lib/research/industry-opt";
import { generateDailyReportForProject } from "@/lib/research/report";
import { lastCompletedPacificDay } from "@/lib/time";

export type AutoDailyProjectResult = {
  projectId: string;
  projectName: string;
  collect: {
    ok: boolean;
    count?: number;
    failures?: number;
    error?: string;
  };
  daily: {
    ok: boolean;
    reportId?: string;
    anomalyCount?: number;
    feishu?: { skipped: boolean };
    email?: { skipped: boolean };
    error?: string;
  };
  industry: {
    ok: boolean;
    reportId?: string;
    mode?: string;
    feishu?: { skipped: boolean };
    email?: { skipped: boolean };
    error?: string;
  };
};

/**
 * 自动项目日更：采集 → 异动日报（美西已过完的一天）→ 行业报告 → 推送。
 * 仅处理 projects.auto_daily = true。
 */
export async function runAutoDailyPipeline() {
  const reportDate = lastCompletedPacificDay(new Date());
  const autoProjects = await listAutoDailyProjects();
  const outputs: AutoDailyProjectResult[] = [];

  for (const project of autoProjects) {
    const row: AutoDailyProjectResult = {
      projectId: project.id,
      projectName: project.name,
      collect: { ok: false },
      daily: { ok: false },
      industry: { ok: false },
    };

    try {
      const collected = await collectProject(project.id);
      row.collect = {
        ok: true,
        count: collected.count,
        failures: collected.failures?.length ?? 0,
      };
    } catch (error) {
      row.collect = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const daily = await generateDailyReportForProject(project.id, reportDate);
      row.daily = {
        ok: true,
        reportId: daily.reportId,
        anomalyCount: daily.anomalyCount,
        feishu: daily.feishu,
        email: daily.email,
      };
    } catch (error) {
      row.daily = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const industry = await generateIndustryOptReport(
        project.id,
        reportDate,
        DEFAULT_COMMERCE_RATES,
      );
      const header = `[asin-lens] ${project.name} ${reportDate} 行业/优化报告（${industry.canonical.mode}）\n\n`;
      const body = header + industry.markdown;
      const feishu = await sendFeishuWebhook(body);
      const email = await sendReportEmail({
        subject: `[asin-lens] ${project.name} ${reportDate} 行业/优化报告`,
        text: body,
      });
      row.industry = {
        ok: true,
        reportId: industry.report.id,
        mode: industry.canonical.mode,
        feishu,
        email,
      };
    } catch (error) {
      row.industry = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    outputs.push(row);
  }

  return {
    reportDate,
    projectCount: autoProjects.length,
    outputs,
  };
}

/**
 * 仅补指定日双报告（不采集）。用于漏跑日回溯；无该日快照时异动可能为空。
 */
export async function runAutoDailyReportsOnly(reportDate: string) {
  const autoProjects = await listAutoDailyProjects();
  const outputs: AutoDailyProjectResult[] = [];

  for (const project of autoProjects) {
    const row: AutoDailyProjectResult = {
      projectId: project.id,
      projectName: project.name,
      collect: { ok: true, count: 0, failures: 0 },
      daily: { ok: false },
      industry: { ok: false },
    };

    try {
      const daily = await generateDailyReportForProject(project.id, reportDate);
      row.daily = {
        ok: true,
        reportId: daily.reportId,
        anomalyCount: daily.anomalyCount,
        feishu: daily.feishu,
        email: daily.email,
      };
    } catch (error) {
      row.daily = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const industry = await generateIndustryOptReport(
        project.id,
        reportDate,
        DEFAULT_COMMERCE_RATES,
      );
      const header = `[asin-lens] ${project.name} ${reportDate} 行业/优化报告（${industry.canonical.mode}）\n\n`;
      const body = header + industry.markdown;
      const feishu = await sendFeishuWebhook(body);
      const email = await sendReportEmail({
        subject: `[asin-lens] ${project.name} ${reportDate} 行业/优化报告`,
        text: body,
      });
      row.industry = {
        ok: true,
        reportId: industry.report.id,
        mode: industry.canonical.mode,
        feishu,
        email,
      };
    } catch (error) {
      row.industry = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    outputs.push(row);
  }

  return {
    reportDate,
    projectCount: autoProjects.length,
    outputs,
  };
}
