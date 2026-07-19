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
