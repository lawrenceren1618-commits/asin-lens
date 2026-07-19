import { NextResponse } from "next/server";
import { z } from "zod";

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

  const body = z
    .object({
      asin: z.string().trim().min(1).max(20),
      market: z.string().trim().max(10).optional(),
      note: z.string().trim().max(200).optional(),
      role: z.enum(["own", "competitor"]).optional(),
    })
    .parse(await request.json());

  const result = await addAsin({
    projectId: id,
    asin: body.asin,
    market: body.market,
    note: body.note,
    role: body.role,
  });

  return NextResponse.json(result);
}
