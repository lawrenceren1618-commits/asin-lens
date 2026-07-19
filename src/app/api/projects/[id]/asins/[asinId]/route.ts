import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/auth";
import { getProject, updateAsin } from "@/lib/db/queries";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; asinId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, asinId } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = z
    .object({
      role: z.enum(["own", "competitor"]).optional(),
      manualCvr60d: z.number().finite().min(0).max(100).nullable().optional(),
      note: z.string().trim().max(200).nullable().optional(),
    })
    .parse(await request.json());

  if (
    body.role === undefined &&
    body.manualCvr60d === undefined &&
    body.note === undefined
  ) {
    return NextResponse.json({ error: "无更新字段" }, { status: 400 });
  }

  const row = await updateAsin(id, asinId, body);
  if (!row) {
    return NextResponse.json({ error: "ASIN not found" }, { status: 404 });
  }

  return NextResponse.json({ row });
}
