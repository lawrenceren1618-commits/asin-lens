import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

/** Idempotent migration for own/competitor + industry opt reports. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const migration = readFileSync(
    resolve(process.cwd(), "drizzle/0001_own_competitor.sql"),
    "utf8",
  );

  const db = getDb();
  try {
    await db.execute(sql.raw(migration));
    return NextResponse.json({
      ok: true,
      applied: "drizzle/0001_own_competitor.sql",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
