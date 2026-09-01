import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  isPacificCronTwinSlot,
  lastCompletedPacificDay,
  pacificHourMinute,
} from "./time";

describe("addCalendarDays", () => {
  it("crosses month bounds", () => {
    expect(addCalendarDays("2026-08-01", -1)).toBe("2026-07-31");
    expect(addCalendarDays("2026-08-26", 1)).toBe("2026-08-27");
  });
});

describe("lastCompletedPacificDay", () => {
  it("labels 3am PDT Aug 27 as Aug 26", () => {
    // 2026-08-27 03:00 PDT = 10:00 UTC
    const at = new Date("2026-08-27T10:00:00Z");
    expect(lastCompletedPacificDay(at)).toBe("2026-08-26");
    expect(pacificHourMinute(at).hour).toBe(3);
    expect(isPacificCronTwinSlot(at)).toBe(false);
  });

  it("skips winter 10:00 UTC (2am PST), keeps 11:00 UTC (3am)", () => {
    const tooEarly = new Date("2027-01-15T10:00:00Z");
    expect(pacificHourMinute(tooEarly).hour).toBe(2);
    expect(isPacificCronTwinSlot(tooEarly)).toBe(true);
    expect(lastCompletedPacificDay(tooEarly)).toBe("2027-01-14");

    const onTime = new Date("2027-01-15T11:00:00Z");
    expect(pacificHourMinute(onTime).hour).toBe(3);
    expect(isPacificCronTwinSlot(onTime)).toBe(false);
    expect(lastCompletedPacificDay(onTime)).toBe("2027-01-14");
  });
});
