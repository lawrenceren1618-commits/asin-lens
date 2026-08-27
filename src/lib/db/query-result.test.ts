import { describe, expect, it } from "vitest";

import { executeQueryRowCount } from "./query-result";

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
