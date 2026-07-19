import { describe, expect, it } from "vitest";

import {
  extractTrafficSourceFromRawRefs,
  formatTrafficSourceLine,
  parseTrafficSourcePayload,
} from "./traffic-source";

describe("traffic-source", () => {
  it("parses Sif overview with ratio fields", () => {
    const result = parseTrafficSourcePayload({
      overview: {
        totalScore: 200,
        naturalScore: { score: 120, ratio: 0.6 },
        adScore: { score: 80, ratio: 0.4 },
      },
      adChannelBreakdown: {
        spScore: { score: 40, ratio: 0.5 },
        recSpScore: { score: 16, ratio: 0.2 },
        sbScore: { score: 16, ratio: 0.2 },
        sbvScore: { score: 8, ratio: 0.1 },
      },
    });

    expect(result.status).toBe("ok");
    expect(result.naturalShare).toBe(0.6);
    expect(result.adShare).toBe(0.4);
    expect(result.channels.sp).toBe(0.5);
    expect(formatTrafficSourceLine(result)).toContain("自然 60.0%");
    expect(formatTrafficSourceLine(result)).toContain("SBV 10.0%");
  });

  it("returns no_result when empty", () => {
    const result = parseTrafficSourcePayload({});
    expect(result.status).toBe("no_result");
    expect(formatTrafficSourceLine(result)).toContain("无结果");
  });

  it("reads structured trafficSource from rawRefs", () => {
    const result = extractTrafficSourceFromRawRefs({
      trafficSource: {
        status: "ok",
        totalScore: 50,
        naturalShare: 0.7,
        adShare: 0.3,
        channels: { sp: 0.3, recSp: null, sb: null, sbv: null },
      },
    });
    expect(result.status).toBe("ok");
    expect(result.naturalShare).toBe(0.7);
  });
});
