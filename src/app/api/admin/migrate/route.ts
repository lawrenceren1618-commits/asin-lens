import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const MIGRATIONS = [
  "drizzle/0001_own_competitor.sql",
  "drizzle/0002_auto_daily.sql",
] as const;

/** Idempotent migrations (own/competitor + auto_daily). */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const applied: string[] = [];
  try {
    for (const file of MIGRATIONS) {
      const migration = readFileSync(resolve(process.cwd(), file), "utf8");
      await db.execute(sql.raw(migration));
      applied.push(file);
    }
    return NextResponse.json({ ok: true, applied });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        applied,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
