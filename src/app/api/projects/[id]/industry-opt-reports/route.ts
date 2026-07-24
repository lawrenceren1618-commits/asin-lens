import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/auth";
import { getProject, listIndustryOptReports } from "@/lib/db/queries";
import { parseCommerceRates } from "@/lib/research/commerce-rates";
import { generateIndustryOptReport } from "@/lib/research/industry-opt";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await listIndustryOptReports(id, 30);
  return NextResponse.json({ items });
}

export async function POST(request: Request, { params }: Params) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    let ratesInput: unknown;
    try {
      const body = (await request.json()) as { commerceRates?: unknown };
      ratesInput = body?.commerceRates;
    } catch {
      ratesInput = undefined;
    }
    const result = await generateIndustryOptReport(
      id,
      undefined,
      parseCommerceRates(ratesInput),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "生成失败",
      },
      { status: 422 },
    );
  }
}
