import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidAsin } from "@/lib/asins/parse";
import { isAuthorized } from "@/lib/auth";
import { addAsin, getProject } from "@/lib/db/queries";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    asin: string;
    market?: string;
    note?: string;
    role?: "own" | "competitor";
  };
  try {
    body = z
      .object({
        asin: z.string().trim().min(1).max(200),
        market: z.string().trim().max(10).optional(),
        note: z.string().trim().max(200).optional(),
        role: z.enum(["own", "competitor"]).optional(),
      })
      .parse(await request.json());
  } catch {
    return NextResponse.json({ error: "请求参数无效" }, { status: 400 });
  }

  if (!isValidAsin(body.asin)) {
    return NextResponse.json(
      {
        error:
          "ASIN 格式有误。应为 10 位字母数字（如 B0CBF6C9FF）。未调用采集。",
      },
      { status: 400 },
    );
  }

  const result = await addAsin({
    projectId: id,
    asin: body.asin,
    market: body.market,
    note: body.note,
    role: body.role,
  });

  return NextResponse.json(result);
}
