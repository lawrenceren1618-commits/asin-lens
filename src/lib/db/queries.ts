import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  asinChangeLog,
  asinSnapshots,
  asins,
  dailyReports,
  projects,
} from "@/lib/db/schema";

export async function listProjects() {
  const db = getDb();
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function createProject(name: string) {
  const db = getDb();
  const [row] = await db.insert(projects).values({ name }).returning();
  return row;
}

export async function getProject(projectId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

export async function listProjectAsins(projectId: string) {
  const db = getDb();
  return db
    .select()
    .from(asins)
    .where(eq(asins.projectId, projectId))
    .orderBy(desc(asins.createdAt));
}

export async function addAsin(input: {
  projectId: string;
  asin: string;
  market?: string;
  note?: string;
}) {
  const db = getDb();
  const asin = input.asin.trim().toUpperCase();
  const market = (input.market ?? "US").trim().toUpperCase() || "US";

  const existing = await db
    .select()
    .from(asins)
    .where(
      and(
        eq(asins.projectId, input.projectId),
        eq(asins.asin, asin),
        eq(asins.market, market),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { row: existing[0], created: false as const };
  }

  const [row] = await db
    .insert(asins)
    .values({
      projectId: input.projectId,
      asin,
      market,
      note: input.note?.trim() || null,
      status: "new",
    })
    .returning();

  return { row, created: true as const };
}

export async function getLatestSnapshot(asinId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(asinSnapshots)
    .where(eq(asinSnapshots.asinId, asinId))
    .orderBy(desc(asinSnapshots.snapshotDate))
    .limit(1);
  return row ?? null;
}

export async function listSnapshotsForProject(
  projectId: string,
  days = 30,
) {
  const db = getDb();
  const projectAsins = await listProjectAsins(projectId);
  if (projectAsins.length === 0) return [];

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);

  const rows = await db
    .select({
      asinId: asinSnapshots.asinId,
      asin: asins.asin,
      market: asins.market,
      snapshotDate: asinSnapshots.snapshotDate,
      title: asinSnapshots.title,
      price: asinSnapshots.price,
      sales: asinSnapshots.sales,
      rank: asinSnapshots.rank,
      cart: asinSnapshots.cart,
      traffic: asinSnapshots.traffic,
      topKeywords: asinSnapshots.topKeywords,
    })
    .from(asinSnapshots)
    .innerJoin(asins, eq(asinSnapshots.asinId, asins.id))
    .where(eq(asins.projectId, projectId))
    .orderBy(asinSnapshots.snapshotDate);

  return rows.filter((row) => row.snapshotDate >= sinceDate);
}

export async function listDailyReports(projectId: string, limit = 14) {
  const db = getDb();
  return db
    .select()
    .from(dailyReports)
    .where(eq(dailyReports.projectId, projectId))
    .orderBy(desc(dailyReports.reportDate))
    .limit(limit);
}

export async function listRecentReports(limit = 20) {
  const db = getDb();
  return db
    .select({
      id: dailyReports.id,
      projectId: dailyReports.projectId,
      projectName: projects.name,
      reportDate: dailyReports.reportDate,
      summaryMd: dailyReports.summaryMd,
      anomalies: dailyReports.anomalies,
      sentFeishuAt: dailyReports.sentFeishuAt,
      sentEmailAt: dailyReports.sentEmailAt,
      createdAt: dailyReports.createdAt,
    })
    .from(dailyReports)
    .innerJoin(projects, eq(dailyReports.projectId, projects.id))
    .orderBy(desc(dailyReports.reportDate), desc(dailyReports.createdAt))
    .limit(limit);
}

export async function getPreviousChange(asinId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(asinChangeLog)
    .where(eq(asinChangeLog.asinId, asinId))
    .orderBy(desc(asinChangeLog.effectiveTo))
    .limit(1);
  return row ?? null;
}
