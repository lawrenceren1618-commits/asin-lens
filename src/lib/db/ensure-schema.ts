import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";

let ensurePromise: Promise<void> | null = null;

/**
 * Ensure projects.auto_daily exists (idempotent).
 * Production may lag behind schema until migrate runs; self-heal on first use.
 */
export function ensureAutoDailyColumn(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const db = getDb();
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
