import { NextResponse } from "next/server";

import { sendFeishuWebhook } from "@/lib/notify/feishu";
import {
  collectAutoDailyIssues,
  formatCronFailureAlert,
} from "@/lib/research/cron-alert";
import { runAutoDailyPipeline } from "@/lib/research/auto-daily";
import { generateDailyReports } from "@/lib/research/report";

export const runtime = "nodejs";
/** 自动项目含 MCP 采集 + 双报告；Hobby 上限可能仍截断，Pro 建议 ≥300 */
export const maxDuration = 300;

const SITE = "https://asin-lens.tuneyas.com";

function isCronAuthorized(request: Request) {
  const auth = request.headers.get("authorization");
  const candidates = [process.env.CRON_SECRET, process.env.ADMIN_TOKEN]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (candidates.length === 0) return false;
  return candidates.some((secret) => auth === `Bearer ${secret}`);
}

async function alertCronFailure(
  input: Parameters<typeof formatCronFailureAlert>[0],
) {
  try {
    await sendFeishuWebhook(formatCronFailureAlert({ site: SITE, ...input }));
  } catch (error) {
    console.error("[cron] failure alert send failed", error);
  }
}

export async function GET(request: Request) {
  // 接受 CRON_SECRET 或 ADMIN_TOKEN（Vercel 定时用前者；手测可用后者）
  if (!isCronAuthorized(request)) {
    await alertCronFailure({
      kind: "unauthorized",
      error: "Bearer 未匹配 CRON_SECRET / ADMIN_TOKEN",
    });
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Bearer 须匹配 Vercel 的 CRON_SECRET 或 ADMIN_TOKEN",
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "auto";

  try {
    // 兼容：mode=legacy 仍对全部项目只跑异动日报（不采集）
    if (mode === "legacy") {
      const outputs = await generateDailyReports();
      return NextResponse.json({ ok: true, mode: "legacy", outputs });
    }

    const result = await runAutoDailyPipeline();
    const issues = collectAutoDailyIssues(result);
    if (issues.length > 0) {
      await alertCronFailure({
        kind: "pipeline",
        reportDate: result.reportDate,
        issues,
      });
    }
    return NextResponse.json({
      ok: issues.length === 0,
      mode: "auto",
      alerted: issues.length > 0,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await alertCronFailure({ kind: "uncaught", error: message });
    return NextResponse.json(
      { ok: false, mode, error: message },
      { status: 500 },
    );
  }
}
