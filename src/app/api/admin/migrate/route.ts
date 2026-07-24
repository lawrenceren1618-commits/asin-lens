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

/** Split SQL file into executable statements (skip comment-only chunks). */
function splitSqlStatements(text: string): string[] {
  return text
    .split(";")
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

function pickMigrations(only: string | undefined): string[] {
  if (!only) return [...MIGRATIONS];
  const needle = only.replace(/\.sql$/i, "");
  const matched = MIGRATIONS.filter(
    (file) => file.includes(needle) || file.endsWith(`${needle}.sql`),
  );
  return matched.length > 0 ? matched : [...MIGRATIONS];
}

/**
 * Idempotent migrations (own/competitor + auto_daily).
 * One statement per execute (postgres-js rejects multi-statement raw).
 * Optional JSON body: `{ "only": "0002" }` to run just auto_daily.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let only: string | undefined;
  try {
    const body = (await request.json()) as { only?: string };
    if (typeof body?.only === "string" && body.only.trim()) {
      only = body.only.trim();
    }
  } catch {
    // empty / non-JSON body → run all
  }

  const files = pickMigrations(only);
  const db = getDb();
  const applied: string[] = [];
  try {
    for (const file of files) {
      const migration = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const statement of splitSqlStatements(migration)) {
        await db.execute(sql.raw(statement));
      }
      applied.push(file);
    }
    return NextResponse.json({ ok: true, applied, only: only ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        applied,
        only: only ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
