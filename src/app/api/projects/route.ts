import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/db/queries";

export const runtime = "nodejs";

function dbErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/password authentication failed/i.test(message)) {
    return "数据库认证失败（密码或连接串不正确）。请到 Supabase → Project Settings → Database，复制 Transaction pooler 的 URI 整段粘贴到 .env.local 的 DATABASE_URL；若密码含 %、@、# 等字符，须已做 URL 编码。改完后重启 npm run dev。";
  }
  if (/DATABASE_URL|ECONN|ENOTFOUND|timeout|postgres|Tenant or user not found/i.test(
    message,
  )) {
    return `数据库不可用：${message}。请确认 DATABASE_URL 使用 Transaction pooler（主机含 pooler.supabase.com，端口 6543，用户为 postgres.<项目ref>）。`;
  }
  if (/relation ["']?projects["']? does not exist/i.test(message)) {
    return "数据库尚未建表。在项目根目录执行：node scripts/apply-schema.mjs";
  }
  return message;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await listProjects();
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: dbErrorMessage(error) },
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
    return NextResponse.json(
      { error: dbErrorMessage(error) },
      { status: 503 },
    );
  }
}
