import { afterEach, describe, expect, it } from "vitest";

import {
  learnedReleaseLatencyMs,
  reportReleaseLatencyMs,
  resetReleaseLatencyForTests
} from "@platform/releaseLatency";

afterEach(() => resetReleaseLatencyForTests());

describe("learnedReleaseLatencyMs", () => {
  it("knows nothing until a flight has been measured", () => {
    // Null is not zero: the first navigation of a status is the one most
    // likely to be slow, so an unmeasured status has to be covered.
    expect(learnedReleaseLatencyMs("PUSHING")).toBeNull();
    reportReleaseLatencyMs("PUSHING", 28.5);
    expect(learnedReleaseLatencyMs("PUSHING")).toBe(28.5);
    expect(learnedReleaseLatencyMs("POPPING")).toBeNull();
  });

  it("rises to a worse reading at once", () => {
    // The head has to cover the bad navigation, not the average one.
    reportReleaseLatencyMs("PUSHING", 9);
    reportReleaseLatencyMs("PUSHING", 40);
    expect(learnedReleaseLatencyMs("PUSHING")).toBe(40);
  });

  it("falls towards a better one slowly, so a run of cheap flights cannot uncover an expensive one", () => {
    reportReleaseLatencyMs("PUSHING", 40);
    reportReleaseLatencyMs("PUSHING", 5);
    const once = learnedReleaseLatencyMs("PUSHING")!;
    expect(once).toBeLessThan(40);
    expect(once).toBeGreaterThan(30);
    for (let i = 0; i < 40; i += 1) reportReleaseLatencyMs("PUSHING", 5);
    // An app that got faster stops paying for the state it has left behind.
    expect(learnedReleaseLatencyMs("PUSHING")).toBeCloseTo(5, 5);
  });

  it("refuses a reading that is not a latency", () => {
    // A stall is not a latency, and neither is a number.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 5000]) {
      reportReleaseLatencyMs("PUSHING", bad);
      expect(learnedReleaseLatencyMs("PUSHING")).toBeNull();
    }
  });
});
