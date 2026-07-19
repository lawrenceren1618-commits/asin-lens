import { describe, expect, it } from "vitest";

import {
  analyzeKeywordTraffic,
  KEYWORD_DAILY_TRAFFIC_MIN,
  mergeKeywordTraffic,
} from "./keyword-traffic";
import {
  formatIndustryOptMd,
  prepareIndustryOptExport,
  verifyIndustryOptCanonical,
} from "./industry-opt-format";

describe("keyword traffic", () => {
  it("merges with Sif-only CVR", () => {
    const rows = mergeKeywordTraffic({
      SellerSprite: {
        keywords: [
          {
            keyword: "desk lamp",
            share: 40,
            dailyTraffic: 200,
            cvr: 9.9,
            bid: 1.2,
          },
        ],
      },
      Sif: {
        keywords: [
          {
            keyword: "desk lamp",
            share: 55,
            dailyTraffic: 180,
            cvr: 12.5,
          },
        ],
      },
    });

    expect(rows[0].share).toBeCloseTo(0.55);
    expect(rows[0].cvr).toBe(12.5);
    expect(rows[0].bid).toBe(1.2);
    expect(rows[0].source).toBe("Sif");
  });

  it("marks concentrated vs dispersed and no_result rules", () => {
    const concentrated = analyzeKeywordTraffic([
      {
        keyword: "a",
        share: 0.4,
        dailyTraffic: 100,
        cvr: 10,
        bid: null,
        spend: null,
        source: "Sif",
      },
      {
        keyword: "b",
        share: 0.2,
        dailyTraffic: 80,
        cvr: null,
        bid: 0.5,
        spend: null,
        source: "Sif",
      },
      {
        keyword: "c",
        share: 0.15,
        dailyTraffic: 20,
        cvr: 8,
        bid: 0.4,
        spend: 3,
        source: "Sif",
      },
    ]);
    expect(concentrated.pattern).toBe("concentrated");
    expect(concentrated.keywords[1].cvr.status).toBe("no_result");
    expect(concentrated.keywords[2].cvr.status).toBe("no_result");
    if (concentrated.keywords[2].cvr.status === "no_result") {
      expect(concentrated.keywords[2].cvr.reason).toContain(
        String(KEYWORD_DAILY_TRAFFIC_MIN),
      );
    }
    expect(concentrated.keywords[0].bid.status).toBe("no_result");

    const dispersed = analyzeKeywordTraffic([
      {
        keyword: "a",
        share: 0.2,
        dailyTraffic: 100,
        cvr: 10,
        bid: 1,
        spend: 2,
        source: "Sif",
      },
      {
        keyword: "b",
        share: 0.15,
        dailyTraffic: 90,
        cvr: 9,
        bid: 1,
        spend: 2,
        source: "Sif",
      },
      {
        keyword: "c",
        share: 0.1,
        dailyTraffic: 80,
        cvr: 8,
        bid: 1,
        spend: 2,
        source: "Sif",
      },
    ]);
    expect(dispersed.pattern).toBe("dispersed");
  });
});

describe("industry opt report", () => {
  it("formats industry-only mode", () => {
    const { markdown, verify } = prepareIndustryOptExport({
      projectId: "p1",
      projectName: "灯具",
      reportDate: "2026-07-19",
      mode: "industry",
      competitorCount: 1,
      ownCount: 0,
      industry: {
        priceMin: 10,
        priceMax: 20,
        priceMedian: 15,
        dispersedAsinCount: 0,
        concentratedAsinCount: 1,
        competitors: [
          {
            asin: "B0TEST1234",
            market: "US",
            role: "competitor",
            title: "Lamp",
            price: 15,
            traffic: 1000,
            sales: 50,
            rank: 10,
            trafficPattern: "concentrated",
            top3ShareSum: 0.8,
            topKeywords: [
              {
                keyword: "desk lamp",
                share: 0.5,
                dailyTraffic: 200,
                source: "Sif",
                cvr: { status: "ok", value: 12 },
                bid: { status: "no_result", reason: "无源数据，无法给出竞价" },
                spend: { status: "no_result", reason: "无源数据，无法给出花费" },
              },
            ],
          },
        ],
      },
    });

    expect(verify.ok).toBe(true);
    expect(markdown).toContain("行业竞品报告");
    expect(markdown).toContain("B0TEST1234");
    expect(formatIndustryOptMd).toBeTypeOf("function");
  });

  it("rejects own mode without optimizations", () => {
    const result = verifyIndustryOptCanonical({
      projectId: "p1",
      projectName: "x",
      reportDate: "2026-07-19",
      mode: "industry_plus_own",
      competitorCount: 0,
      ownCount: 1,
      industry: {
        priceMin: null,
        priceMax: null,
        priceMedian: null,
        dispersedAsinCount: 0,
        concentratedAsinCount: 0,
        competitors: [],
      },
    });
    expect(result.ok).toBe(false);
  });
});
