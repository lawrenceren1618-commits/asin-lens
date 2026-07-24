import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getProject, listProjectAsins, listProjects } from "@/lib/db/queries";
import { asinSnapshots, dailyReports } from "@/lib/db/schema";
import { sendReportEmail } from "@/lib/notify/email";
import { sendFeishuWebhook } from "@/lib/notify/feishu";
import {
  prepareReportExport,
  type ReportAnomaly,
} from "@/lib/research/report-format";
import { shanghaiYesterday } from "@/lib/time";

function pctChange(previous: number | null, current: number | null) {
  if (previous === null || current === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export async function generateDailyReportForProject(
  projectId: string,
  reportDate = shanghaiYesterday(),
) {
  const db = getDb();
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const projectAsins = await listProjectAsins(projectId);
  const anomalies: ReportAnomaly[] = [];

  for (const asin of projectAsins) {
    const snaps = await db
      .select()
      .from(asinSnapshots)
      .where(eq(asinSnapshots.asinId, asin.id))
      .orderBy(asinSnapshots.snapshotDate);

    const current = snaps.find((s) => s.snapshotDate === reportDate);
    if (!current) continue;
    const previous = [...snaps]
      .reverse()
      .find((s) => s.snapshotDate < reportDate);
    if (!previous) continue;

    const prevPrice = previous.price === null ? null : Number(previous.price);
    const curPrice = current.price === null ? null : Number(current.price);
    const pricePct = pctChange(prevPrice, curPrice);
    if (pricePct !== null && Math.abs(pricePct) >= 5) {
      anomalies.push({
        asin: asin.asin,
        market: asin.market,
        field: "price",
        previous: prevPrice,
        current: curPrice,
        changePct: Number(pricePct.toFixed(2)),
      });
    }

    const prevTraffic =
      previous.traffic === null ? null : Number(previous.traffic);
    const curTraffic =
      current.traffic === null ? null : Number(current.traffic);
    const trafficPct = pctChange(prevTraffic, curTraffic);
    if (trafficPct !== null && Math.abs(trafficPct) >= 20) {
      anomalies.push({
        asin: asin.asin,
        market: asin.market,
        field: "traffic",
        previous: prevTraffic,
        current: curTraffic,
        changePct: Number(trafficPct.toFixed(2)),
      });
    }
  }

  const { report: canonical, markdown, verify } = prepareReportExport({
    projectId: project.id,
    projectName: project.name,
    reportDate,
    asinCount: projectAsins.length,
    anomalies,
  });

  const existing = await db
    .select()
    .from(dailyReports)
    .where(
      and(
        eq(dailyReports.projectId, project.id),
        eq(dailyReports.reportDate, reportDate),
      ),
    )
    .limit(1);

  let report = existing[0];
  if (report) {
    const [updated] = await db
      .update(dailyReports)
      .set({ summaryMd: markdown, anomalies: canonical.anomalies })
      .where(eq(dailyReports.id, report.id))
      .returning();
    report = updated;
  } else {
    const [created] = await db
      .insert(dailyReports)
      .values({
        projectId: project.id,
        reportDate,
        summaryMd: markdown,
        anomalies: canonical.anomalies,
      })
      .returning();
    report = created;
  }

  const feishu = await sendFeishuWebhook(markdown);
  const email = await sendReportEmail({
    subject: `[asin-lens] ${project.name} ${reportDate} 异动日报`,
    text: markdown,
  });

  const [finalReport] = await db
    .update(dailyReports)
    .set({
      sentFeishuAt: feishu.skipped ? report.sentFeishuAt : new Date(),
      sentEmailAt: email.skipped ? report.sentEmailAt : new Date(),
    })
    .where(eq(dailyReports.id, report.id))
    .returning();

  return {
    projectId: project.id,
    projectName: project.name,
    reportDate,
    anomalyCount: canonical.anomalies.length,
    verify: { ok: verify.ok, issues: verify.issues },
    feishu,
    email,
    reportId: finalReport.id,
  };
}

export async function generateDailyReports(reportDate = shanghaiYesterday()) {
  const allProjects = await listProjects();
  const outputs = [];
  for (const project of allProjects) {
    outputs.push(await generateDailyReportForProject(project.id, reportDate));
  }
  return outputs;
}
