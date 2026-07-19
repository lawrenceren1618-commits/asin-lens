import { describe, expect, it } from "vitest";

import { parseAsinCsv } from "./csv";

describe("parseAsinCsv", () => {
  it("parses valid rows and reports bad asins", () => {
    const result = parseAsinCsv(
      "asin,market,note\nB0TEST1234,US,ok\nbad,US,x\n",
    );
    expect(result.rows).toEqual([
      { asin: "B0TEST1234", market: "US", note: "ok" },
    ]);
    expect(result.errors[0]).toContain("格式无效");
  });
});
