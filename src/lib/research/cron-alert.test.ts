import { describe, expect, it } from "vitest";

import type { AutoDailyProjectResult } from "./auto-daily";
import {
  collectAutoDailyIssues,
  formatCronFailureAlert,
} from "./cron-alert";

function baseRow(
  overrides: Partial<AutoDailyProjectResult> &
    Pick<AutoDailyProjectResult, "projectName">,
): AutoDailyProjectResult {
  return {
    projectId: "p1",
    projectName: overrides.projectName,
    collect: { ok: true, count: 2, failures: 0 },
    daily: { ok: true, reportId: "d1" },
    industry: { ok: true, reportId: "i1", mode: "industry_only" },
    ...overrides,
  };
}

describe("collectAutoDailyIssues", () => {
  it("flags empty auto_daily set", () => {
    expect(
      collectAutoDailyIssues({
        reportDate: "2026-07-26",
        projectCount: 0,
        outputs: [],
      }),
    ).toEqual([
      {
        step: "pipeline",
        detail: "无 auto_daily 项目，Cron 未采集/未出报告",
      },
    ]);
  });

  it("flags step errors and partial collect failures", () => {
    const issues = collectAutoDailyIssues({
      reportDate: "2026-07-26",
      projectCount: 1,
      outputs: [
        baseRow({
          projectName: "table cloth",
          collect: { ok: true, count: 2, failures: 1 },
          daily: { ok: false, error: "no prior snapshot" },
          industry: { ok: false, error: "boom" },
        }),
      ],
    });

    expect(issues).toEqual([
      {
        projectName: "table cloth",
        step: "collect",
        detail: "部分 ASIN 失败 failures=1",
      },
      {
        projectName: "table cloth",
        step: "daily",
        detail: "no prior snapshot",
      },
      {
        projectName: "table cloth",
        step: "industry",
        detail: "boom",
      },
    ]);
  });

  it("returns empty when all steps ok", () => {
    expect(
      collectAutoDailyIssues({
        reportDate: "2026-07-26",
        projectCount: 1,
        outputs: [baseRow({ projectName: "table cloth" })],
      }),
    ).toEqual([]);
  });
});

describe("formatCronFailureAlert", () => {
  it("includes site, kind, and issue lines", () => {
    const text = formatCronFailureAlert({
      kind: "pipeline",
      reportDate: "2026-07-26",
      issues: [
        {
          projectName: "table cloth",
          step: "daily",
          detail: "timeout",
        },
      ],
    });

    expect(text).toContain("[asin-lens] Cron 失败告警");
    expect(text).toContain("asin-lens.tuneyas.com");
    expect(text).toContain("报告日: 2026-07-26");
    expect(text).toContain("类型: pipeline");
    expect(text).toContain("table cloth/daily: timeout");
  });
});
