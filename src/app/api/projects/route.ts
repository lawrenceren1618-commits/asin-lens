import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/auth";
import { flattenQueryError } from "@/lib/db/query-result";
import {
  createProject,
  listProjectNames,
  listProjects,
  nextUniqueProjectName,
} from "@/lib/db/queries";

export const runtime = "nodejs";

function dbErrorMessage(error: unknown): string {
  const message = flattenQueryError(error);
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
      .object({
        name: z
          .string()
          .trim()
          .min(1, "项目名称不能为空")
          .max(120, "项目名称过长"),
        /** 用户已确认：同名时自动加后缀 1、2… */
        acceptDuplicateSuffix: z.boolean().optional(),
      })
      .parse(await request.json());

    const existingNames = await listProjectNames();
    const exactTaken = existingNames.some(
      (name) => name.trim() === body.name,
    );

    if (exactTaken && !body.acceptDuplicateSuffix) {
      const suggestedName = nextUniqueProjectName(body.name, existingNames);
      return NextResponse.json(
        {
          error: `已有同名项目「${body.name}」。坚持创建将命名为「${suggestedName}」。`,
          conflict: true,
          suggestedName,
        },
        { status: 409 },
      );
    }

    const finalName = exactTaken
      ? nextUniqueProjectName(body.name, existingNames)
      : body.name;
    const project = await createProject(finalName);
    return NextResponse.json({
      project,
      renamed: finalName !== body.name,
      requestedName: body.name,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first =
        error.issues[0]?.message ?? "项目名称不能为空或仅含空格";
      return NextResponse.json(
        { error: first, details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: dbErrorMessage(error) },
      { status: 503 },
    );
  }
}
