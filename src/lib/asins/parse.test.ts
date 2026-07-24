import { describe, expect, it } from "vitest";

import { extractAsin, extractAsins, isValidAsin } from "./parse";

describe("extractAsin", () => {
  it("accepts plain ASIN", () => {
    expect(extractAsin("B0CBF6C9FF")).toEqual({
      ok: true,
      asin: "B0CBF6C9FF",
    });
    expect(extractAsin(" b0cbf6c9ff ")).toEqual({
      ok: true,
      asin: "B0CBF6C9FF",
    });
  });

  it("extracts from amazon url", () => {
    expect(
      extractAsin("https://www.amazon.com/dp/B0CBF6C9FF?th=1"),
    ).toEqual({ ok: true, asin: "B0CBF6C9FF" });
  });

  it("rejects bad format without inventing", () => {
    const bad = extractAsin("not-an-asin");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error).toContain("格式有误");
      expect(bad.error).toContain("未调用采集");
    }
    expect(isValidAsin("B0SHORT")).toBe(false);
  });
});

describe("extractAsins", () => {
  it("finds multiple asins from paste blob in order", () => {
    const result = extractAsins(
      "mine B0CCRKDW1K and https://www.amazon.com/dp/B0CBF6C9FF competitor",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asins).toEqual(["B0CCRKDW1K", "B0CBF6C9FF"]);
    }
  });
});
