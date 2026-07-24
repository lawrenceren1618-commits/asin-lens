import { describe, expect, it } from "vitest";

import {
  cleanToMetrics,
  prepareMetricsForStorage,
  verifyMetrics,
} from "./metrics";
import {
  formatDailyReportMd,
  prepareReportExport,
  verifyReportCanonical,
} from "./report-format";

describe("metrics clean + verify", () => {
  it("cleans MCP payloads into canonical metrics", () => {
    const cleaned = cleanToMetrics([
      {
        source: "SellerSprite",
        tool: "asin_detail",
        raw: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "Desk Lamp",
                price: "$19.99",
                sales: "120",
                rank: 88,
              }),
            },
          ],
        },
      },
    ]);

    expect(cleaned.title).toBe("Desk Lamp");
    expect(cleaned.price).toBe(19.99);
    expect(cleaned.sales).toBe(120);
    expect(cleaned.rank).toBe(88);
    expect(cleaned.rawRefs.sources).toBeTruthy();
  });

  it("respects source priority for conflicting fields", () => {
    const cleaned = cleanToMetrics(
      [
        {
          source: "SellerSprite",
          tool: "asin_detail",
          raw: { content: [{ type: "text", text: JSON.stringify({ price: 10 }) }] },
        },
        {
          source: "Sif",
          tool: "asin_detail",
          raw: { content: [{ type: "text", text: JSON.stringify({ price: 99, title: "From Sif" }) }] },
        },
      ],
      {
        order: ["Sif", "SellerSprite"],
        fields: {},
      },
    );
    expect(cleaned.price).toBe(99);
    expect(cleaned.title).toBe("From Sif");
  });

  it("default: non-traffic prefers SellerSprite, traffic prefers Sif", () => {
    const cleaned = cleanToMetrics([
      {
        source: "SellerSprite",
        tool: "asin_detail",
        raw: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "SS Title",
                price: 10,
                traffic: 100,
              }),
            },
          ],
        },
      },
      {
        source: "Sif",
        tool: "detail",
        raw: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "Sif Title",
                price: 99,
                traffic: 999,
              }),
            },
          ],
        },
      },
    ]);
    expect(cleaned.title).toBe("SS Title");
    expect(cleaned.price).toBe(10);
    expect(cleaned.traffic).toBe(999);
  });

  it("rejects empty garbage before storage", () => {
    expect(() =>
      prepareMetricsForStorage([
        {
          source: "SellerSprite",
          tool: "asin_detail",
          raw: { content: [{ type: "text", text: "{}" }] },
        },
      ]),
    ).toThrow(/核对未通过/);
  });

  it("accepts a valid signal set", () => {
    const result = verifyMetrics({
      title: "A",
      price: 10,
      sales: null,
      rank: null,
      cart: "",
      traffic: null,
      topKeywords: [],
      keywordTraffic: [],
      rawRefs: {},
    });
    expect(result.ok).toBe(true);
    expect(result.hasSignal).toBe(true);
  });
});

describe("report verify + format", () => {
  it("formats only after verify passes", () => {
    const { markdown, verify } = prepareReportExport({
      projectId: "p1",
      projectName: "灯具",
      reportDate: "2026-07-18",
      asinCount: 2,
      anomalies: [
        {
          asin: "B0TEST1234",
          market: "US",
          field: "price",
          previous: 10,
          current: 12,
          changePct: 20,
        },
      ],
    });

    expect(verify.ok).toBe(true);
    expect(markdown).toContain("灯具 日报 2026-07-18");
    expect(markdown).toContain("B0TEST1234");
    expect(formatDailyReportMd).toBeTypeOf("function");
  });

  it("fails closed on bad shape", () => {
    const result = verifyReportCanonical({
      projectId: "p1",
      projectName: "x",
      reportDate: "bad",
      asinCount: 1,
      anomalies: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe("keepa_info merge", () => {
  it("does not let keepa price trend overwrite asin_detail price", () => {
    const metrics = cleanToMetrics([
      {
        source: "SellerSprite",
        tool: "asin_detail",
        raw: {
          asin: "B0TEST",
          title: "FINDYOU 10 Pack White Table Cloth",
          price: 39.5,
          bsrRank: 1200,
          bsrLabel: "Home & Kitchen",
          deliveryPrice: -1,
          weight: "2 pounds",
        },
      },
      {
        source: "SellerSprite",
        tool: "keepa_info",
        raw: {
          asin: "B0TEST",
          title: "FINDYOU 10 Pack White Table Cloth",
          price: [{ time: 1, value: 40 }],
          bsr: [{ time: 1, value: 900 }],
          fbaFees: 5.2,
          pkgWeightGram: 2000,
          rootCategoryLabel: "Home & Kitchen",
          nodeLabelPath: "Home & Kitchen:Kitchen:Tablecloths",
        },
      },
    ]);

    expect(metrics.price).toBe(39.5);
    expect(metrics.rank).toBe(1200);
    expect(metrics.rawRefs.listingExtras).toMatchObject({
      fbaFees: 5.2,
      pkgWeightGram: 2000,
      bsrLabel: "Home & Kitchen",
    });
  });
});
