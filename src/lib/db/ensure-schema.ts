import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { executeQueryRowCount } from "@/lib/db/query-result";

let ensurePromise: Promise<void> | null = null;

/**
 * Ensure projects.auto_daily exists (idempotent).
 * Transaction pooler often rejects DDL; if the column is already there, skip ALTER.
 */
export function ensureAutoDailyColumn(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const db = getDb();
      const existing = await db.execute(
        sql.raw(
          `SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'projects'
             AND column_name = 'auto_daily'
           LIMIT 1`,
        ),
      );
      if (executeQueryRowCount(existing) > 0) return;

      await db.execute(
        sql.raw(
          `ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_daily boolean NOT NULL DEFAULT false`,
        ),
      );
      await db.execute(
        sql.raw(
          `CREATE INDEX IF NOT EXISTS projects_auto_daily_idx ON projects (auto_daily) WHERE auto_daily = true`,
        ),
      );
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}
