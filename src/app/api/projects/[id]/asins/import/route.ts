import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/auth";
import { parseAsinCsv } from "@/lib/asins/csv";
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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseAsinCsv(text);
  let created = 0;
  let skipped = 0;

  for (const row of parsed.rows) {
    const result = await addAsin({
      projectId: id,
      asin: row.asin,
      market: row.market,
      note: row.note,
      role: row.role,
    });
    if (result.created) created += 1;
    else skipped += 1;
  }

  return NextResponse.json({
    created,
    skipped,
    errors: parsed.errors,
    totalRows: parsed.rows.length,
  });
}
