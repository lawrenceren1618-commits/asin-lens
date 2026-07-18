import { describe, expect, it } from "vitest";

import { normalizeToolResult, stableKey } from "./normalize";

describe("normalizeToolResult", () => {
  it("extracts array data from MCP text content", () => {
    const result = normalizeToolResult({
      source: "SellerSprite",
      tool: "asin_detail",
      raw: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              data: [
                { asin: "B001", sales: 10 },
                { asin: "B002", sales: 20 },
              ],
            }),
          },
        ],
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0].data).toEqual({ asin: "B001", sales: 10 });
  });

  it("creates stable daily identity keys", () => {
    const item = {
      source: "Sif" as const,
      tool: "keyword",
      data: { keyword: "desk lamp", rank: 1 },
      rawSummary: "",
    };

    expect(stableKey(item, "20260716", "US")).toBe(
      stableKey(
        { ...item, data: { keyword: "desk lamp", rank: 99 } },
        "20260716",
        "US",
      ),
    );
    expect(stableKey(item, "20260716", "US")).not.toBe(
      stableKey(item, "20260717", "US"),
    );
  });
});
