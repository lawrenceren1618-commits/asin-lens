import { NextResponse } from "next/server";

import { runAutoDailyPipeline } from "@/lib/research/auto-daily";
import { generateDailyReports } from "@/lib/research/report";

export const runtime = "nodejs";
/** 自动项目含 MCP 采集 + 双报告；Hobby 上限可能仍截断，Pro 建议 ≥300 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "auto";

  // 兼容：mode=legacy 仍对全部项目只跑异动日报（不采集）
  if (mode === "legacy") {
    const outputs = await generateDailyReports();
    return NextResponse.json({ ok: true, mode: "legacy", outputs });
  }

  const result = await runAutoDailyPipeline();
  return NextResponse.json({ ok: true, mode: "auto", ...result });
}
