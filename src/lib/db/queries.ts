import "server-only";

import { and, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ensureAutoDailyColumn } from "@/lib/db/ensure-schema";
import {
  asinChangeLog,
  asinSnapshots,
  asins,
  dailyReports,
  industryOptReports,
  projects,
  type AsinRole,
} from "@/lib/db/schema";

export async function listProjects() {
  const db = getDb();
  try {
    await ensureAutoDailyColumn();
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  } catch {
    // Pooler/role may reject DDL; list without auto_daily until SQL is applied in Supabase.
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .orderBy(desc(projects.createdAt));
    return rows.map((row) => ({ ...row, autoDaily: false }));
  }
}

export async function listProjectNames() {
  const db = getDb();
  const rows = await db.select({ name: projects.name }).from(projects);
  return rows.map((row) => row.name);
}

export async function listProjectNamesExcept(projectId: string) {
  const db = getDb();
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(ne(projects.id, projectId));
  return rows.map((row) => row.name);
}

/** 名称已被占用时：base → base1 → base2 … */
export function nextUniqueProjectName(
  desired: string,
  existingNames: string[],
) {
  const base = desired.trim();
  const taken = new Set(existingNames.map((name) => name.trim()));
  if (!taken.has(base)) return base;
  let suffix = 1;
  while (taken.has(`${base}${suffix}`)) {
    suffix += 1;
  }
  return `${base}${suffix}`;
}

export async function createProject(name: string) {
  await ensureAutoDailyColumn();
  const db = getDb();
  const [row] = await db
    .insert(projects)
    .values({ name: name.trim() })
    .returning();
  return row;
}

export async function updateProjectName(projectId: string, name: string) {
  const db = getDb();
  const [row] = await db
    .update(projects)
    .set({ name: name.trim() })
    .where(eq(projects.id, projectId))
    .returning();
  return row ?? null;
}

export async function updateProjectAutoDaily(
  projectId: string,
  autoDaily: boolean,
) {
  await ensureAutoDailyColumn();
  const db = getDb();
  const [row] = await db
    .update(projects)
    .set({ autoDaily })
    .where(eq(projects.id, projectId))
    .returning();
  return row ?? null;
}

export async function listAutoDailyProjects() {
  await ensureAutoDailyColumn();
  const db = getDb();
  return db
    .select()
    .from(projects)
    .where(eq(projects.autoDaily, true))
    .orderBy(desc(projects.createdAt));
}

/** 删除尚无任何 ASIN 的空壳项目（级联清关联表）。 */
export async function deleteProjectsWithoutAsins() {
  const db = getDb();
  const emptyRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .leftJoin(asins, eq(asins.projectId, projects.id))
    .where(isNull(asins.id));

  const deleted: { id: string; name: string }[] = [];
  for (const row of emptyRows) {
    await db.delete(projects).where(eq(projects.id, row.id));
    deleted.push(row);
  }
  return deleted;
}

export async function getProject(projectId: string) {
  const db = getDb();
  try {
    await ensureAutoDailyColumn();
    const [row] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row ?? null;
  } catch {
    const [row] = await db
      .select({
        id: projects.id,
        name: projects.name,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row ? { ...row, autoDaily: false } : null;
  }
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
  role?: AsinRole;
}) {
  const db = getDb();
  const asin = input.asin.trim().toUpperCase();
  const market = (input.market ?? "US").trim().toUpperCase() || "US";
  const role: AsinRole = input.role === "own" ? "own" : "competitor";

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
      role,
      status: "new",
    })
    .returning();

  return { row, created: true as const };
}

export async function updateAsin(
  projectId: string,
  asinId: string,
  patch: {
    role?: AsinRole;
    manualCvr60d?: number | null;
    note?: string | null;
  },
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(asins)
    .where(and(eq(asins.id, asinId), eq(asins.projectId, projectId)))
    .limit(1);
  if (!existing) return null;

  const [row] = await db
    .update(asins)
    .set({
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.manualCvr60d !== undefined
        ? {
            manualCvr60d:
              patch.manualCvr60d === null ? null : String(patch.manualCvr60d),
          }
        : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    })
    .where(eq(asins.id, asinId))
    .returning();

  return row;
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

/** 一次查出多个 ASIN 的最新快照（消灭 N+1 往返） */
export async function listLatestSnapshotsForAsinIds(asinIds: string[]) {
  if (asinIds.length === 0) {
    return new Map<
      string,
      {
        title: string | null;
        price: string | null;
        sales: number | null;
        rank: number | null;
        cart: string | null;
        traffic: string | null;
        topKeywords: string[] | null;
      }
    >();
  }

  const db = getDb();
  const rows = await db
    .select({
      asinId: asinSnapshots.asinId,
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
    .where(inArray(asinSnapshots.asinId, asinIds))
    .orderBy(desc(asinSnapshots.snapshotDate));

  const latest = new Map<
    string,
    {
      title: string | null;
      price: string | null;
      sales: number | null;
      rank: number | null;
      cart: string | null;
      traffic: string | null;
      topKeywords: string[] | null;
    }
  >();
  for (const row of rows) {
    if (latest.has(row.asinId)) continue;
    latest.set(row.asinId, {
      title: row.title,
      price: row.price,
      sales: row.sales,
      rank: row.rank,
      cart: row.cart,
      traffic: row.traffic,
      topKeywords: row.topKeywords,
    });
  }
  return latest;
}

export async function listSnapshotsForProject(
  projectId: string,
  days = 30,
) {
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);

  return db
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
    .where(
      and(
        eq(asins.projectId, projectId),
        gte(asinSnapshots.snapshotDate, sinceDate),
      ),
    )
    .orderBy(asinSnapshots.snapshotDate);
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

export async function listIndustryOptReports(projectId: string, limit = 14) {
  const db = getDb();
  return db
    .select()
    .from(industryOptReports)
    .where(eq(industryOptReports.projectId, projectId))
    .orderBy(desc(industryOptReports.reportDate))
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
