import { describe, expect, it } from "vitest";

import { executeQueryRowCount, flattenQueryError } from "./query-result";

describe("executeQueryRowCount", () => {
  it("counts array rows", () => {
    expect(executeQueryRowCount([{ ok: 1 }])).toBe(1);
    expect(executeQueryRowCount([])).toBe(0);
  });

  it("counts array-like length", () => {
    const rows = { length: 1, 0: { ok: 1 } };
    expect(executeQueryRowCount(rows)).toBe(1);
  });

  it("counts nested rows", () => {
    expect(executeQueryRowCount({ rows: [{ ok: 1 }, { ok: 1 }] })).toBe(2);
  });
});

describe("flattenQueryError", () => {
  it("joins Error.cause chain", () => {
    const inner = new Error("column auto_daily does not exist");
    const outer = new Error("Failed query: select auto_daily");
    outer.cause = inner;
    expect(flattenQueryError(outer)).toBe(
      "Failed query: select auto_daily | column auto_daily does not exist",
    );
  });
});
