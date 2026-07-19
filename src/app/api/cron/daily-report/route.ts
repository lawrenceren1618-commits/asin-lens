import { NextResponse } from "next/server";

import { generateDailyReports } from "@/lib/research/report";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const outputs = await generateDailyReports();
  return NextResponse.json({ ok: true, outputs });
}
