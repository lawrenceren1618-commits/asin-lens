import { describe, expect, it } from "vitest";

import { planChangeLogWrite } from "./change-log";

const previous = {
  id: "log-1",
  effectiveFrom: "2026-07-23",
  effectiveTo: "2026-07-23",
};

describe("planChangeLogWrite", () => {
  it("inserts a new row after a collection gap when metrics changed", () => {
    expect(
      planChangeLogWrite({
        day: "2026-08-31",
        changed: true,
        previous,
      }),
    ).toEqual({ type: "insert", closePrevious: null });
  });

  it("extends the current range when metrics are unchanged", () => {
    expect(
      planChangeLogWrite({
        day: "2026-08-31",
        changed: false,
        previous,
      }),
    ).toEqual({
      type: "extend",
      previousId: "log-1",
      effectiveTo: "2026-08-31",
    });
  });

  it("updates in place on same-day recollect with a change", () => {
    expect(
      planChangeLogWrite({
        day: "2026-07-23",
        changed: true,
        previous,
      }),
    ).toEqual({ type: "update_in_place", previousId: "log-1" });
  });

  it("inserts the first row when there is no previous log", () => {
    expect(
      planChangeLogWrite({
        day: "2026-09-01",
        changed: true,
        previous: null,
      }),
    ).toEqual({ type: "insert", closePrevious: null });
  });

  it("closes an overlapping open range then inserts", () => {
    expect(
      planChangeLogWrite({
        day: "2026-08-26",
        changed: true,
        previous: {
          id: "log-open",
          effectiveFrom: "2026-08-20",
          effectiveTo: "2026-08-27",
        },
      }),
    ).toEqual({
      type: "insert",
      closePrevious: { id: "log-open", effectiveTo: "2026-08-25" },
    });
  });

  it("does nothing when unchanged and there is no previous log", () => {
    expect(
      planChangeLogWrite({
        day: "2026-09-01",
        changed: false,
        previous: null,
      }),
    ).toEqual({ type: "noop" });
  });
});
