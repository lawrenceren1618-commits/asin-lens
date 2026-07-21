import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await listProjects();
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: /DATABASE_URL|ECONN|ENOTFOUND|timeout|postgres/i.test(message)
          ? `数据库不可用：${message}。请确认 DATABASE_URL 使用 Supabase Transaction pooler（端口 6543）。`
          : message,
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = z
      .object({ name: z.string().trim().min(1).max(120) })
      .parse(await request.json());
    const project = await createProject(body.name);
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "项目名称无效", details: error.flatten() },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: /DATABASE_URL|ECONN|ENOTFOUND|timeout|postgres/i.test(message)
          ? `数据库不可用：${message}。请确认 DATABASE_URL 使用 Supabase Transaction pooler（端口 6543）。`
          : message,
      },
      { status: 503 },
    );
  }
}
