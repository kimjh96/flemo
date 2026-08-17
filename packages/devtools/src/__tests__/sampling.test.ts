import { describe, expect, it } from "vitest";

import {
  classifyDriver,
  computeFrameStats,
  computePlayerGapStats,
  kindFromStatus,
  parseTranslateX
} from "../sampling";

describe("computeFrameStats", () => {
  it("handles the empty case", () => {
    expect(computeFrameStats([])).toEqual({ count: 0, medianGapMs: 0, maxGapMs: 0, longGaps: [] });
  });

  it("computes median, max, and long gaps in order", () => {
    const stats = computeFrameStats([16.7, 16.6, 41.2, 16.8, 33.0]);
    expect(stats.count).toBe(5);
    expect(stats.medianGapMs).toBe(16.8);
    expect(stats.maxGapMs).toBe(41.2);
    expect(stats.longGaps).toEqual([41.2, 33]);
  });
});

describe("computePlayerGapStats", () => {
  it("returns null when the player mirror did not grow", () => {
    expect(computePlayerGapStats([])).toBeNull();
  });

  it("summarizes max and over-30 count", () => {
    expect(computePlayerGapStats([16.7, 42.1, 16.7, 31.0])).toEqual({
      maxMs: 42.1,
      over30Count: 2
    });
  });
});

describe("classifyDriver", () => {
  it("classifies inline suppression + advance as player", () => {
    expect(
      classifyDriver({ compiledAnimation: false, playerSuppression: true, playerAdvance: true })
    ).toBe("player");
  });

  it("classifies a running flemo-* CSSAnimation as compiled", () => {
    expect(
      classifyDriver({ compiledAnimation: true, playerSuppression: false, playerAdvance: false })
    ).toBe("compiled");
  });

  it("classifies both signatures as mixed", () => {
    expect(
      classifyDriver({ compiledAnimation: true, playerSuppression: true, playerAdvance: false })
    ).toBe("mixed");
  });

  it("classifies no signature as unknown", () => {
    expect(
      classifyDriver({ compiledAnimation: false, playerSuppression: false, playerAdvance: false })
    ).toBe("unknown");
  });
});

describe("kindFromStatus", () => {
  it("maps transitional statuses and rejects the rest", () => {
    expect(kindFromStatus("PUSHING")).toBe("PUSH");
    expect(kindFromStatus("POPPING")).toBe("POP");
    expect(kindFromStatus("REPLACING")).toBe("REPLACE");
    expect(kindFromStatus("COMPLETED")).toBeNull();
    expect(kindFromStatus("IDLE")).toBeNull();
  });
});

describe("parseTranslateX", () => {
  it("parses matrix() tx", () => {
    expect(parseTranslateX("matrix(1, 0, 0, 1, -390, 0)")).toBe(-390);
  });

  it("parses matrix3d() tx", () => {
    expect(parseTranslateX("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 402, 0, 0, 1)")).toBe(402);
  });

  it("returns null for none/empty/garbage", () => {
    expect(parseTranslateX("none")).toBeNull();
    expect(parseTranslateX("")).toBeNull();
    expect(parseTranslateX("translate3d(100%, 0, 0)")).toBeNull();
  });

  it("returns null for malformed matrix payloads", () => {
    expect(parseTranslateX("matrix3d(1, 2, 3)")).toBeNull();
    expect(parseTranslateX("matrix(1, 0, 0, 1, abc, 0)")).toBeNull();
    expect(parseTranslateX("matrix(1, 0, 0)")).toBeNull();
  });
});
