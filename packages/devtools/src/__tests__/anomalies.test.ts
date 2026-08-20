import { describe, expect, it } from "vitest";

import { deriveFlightAnomalies, deriveReportAnomalies } from "../anomalies";

import type { FlightAnomalyInput } from "../anomalies";
import type { FramePhaseStats } from "../types";

const phase = (over: Partial<FramePhaseStats> = {}): FramePhaseStats => ({
  count: 24,
  medianGapMs: 16.7,
  maxGapMs: 18.2,
  over30Count: 0,
  ...over
});

const cleanFlight = (): FlightAnomalyInput => ({
  t0Ms: 1000,
  t1Ms: 1400,
  driver: "compiled",
  frameSamples: {
    count: 24,
    medianGapMs: 16.7,
    maxGapMs: 18.2,
    longGaps: [],
    held: phase({ count: 0, medianGapMs: 0, maxGapMs: 0 }),
    released: phase()
  },
  playerGaps: null,
  longTasks: [],
  holdLongTasks: [],
  releasedAtMs: null,
  landing: {
    residualInlineTransforms: [],
    offViewportAtRest: false,
    stuckStatuses: [],
    orphanedHolds: []
  },
  motion: {
    sampledFrames: 24,
    stalledFrames: 0,
    longestStallMs: 0,
    tailFrames: 0,
    pausedAfterRelease: false,
    holdReassertedAtMs: null
  },
  images: {
    loadingAtStart: 0,
    addedDuringFlight: 0,
    completedDuringFlight: 0,
    heldDuringFlight: 0,
    completedUnheld: 0
  }
});

describe("deriveFlightAnomalies", () => {
  it("returns no anomalies for a clean compiled flight", () => {
    expect(deriveFlightAnomalies(cleanFlight())).toEqual([]);
  });

  it("flags player frame gaps with count and max", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      driver: "player",
      playerGaps: { maxMs: 42, over30Count: 3 }
    });
    expect(anomalies.some((entry) => entry.includes("player frame gap up to 42ms ×3"))).toBe(true);
  });

  it("flags released-phase main-thread rAF gaps, softened for compiled flights", () => {
    const base = cleanFlight();
    const anomalies = deriveFlightAnomalies({
      ...base,
      frameSamples: {
        ...base.frameSamples,
        maxGapMs: 55,
        longGaps: [41, 55],
        released: phase({ maxGapMs: 55, over30Count: 2 })
      }
    });
    const line = anomalies.find((entry) => entry.includes("main-thread rAF gap"));
    expect(line).toContain("up to 55ms ×2");
    expect(line).toContain("during visible motion");
    expect(line).toContain("can still present cleanly");
  });

  it("does not soften main-thread gaps for player flights", () => {
    const base = cleanFlight();
    const anomalies = deriveFlightAnomalies({
      ...base,
      driver: "player",
      frameSamples: {
        ...base.frameSamples,
        maxGapMs: 55,
        longGaps: [55],
        released: phase({ maxGapMs: 55, over30Count: 1 })
      }
    });
    const line = anomalies.find((entry) => entry.includes("main-thread rAF gap"));
    expect(line).not.toContain("can still present cleanly");
  });

  it("does NOT flag gaps confined to the hold phase (absorbed by design)", () => {
    const base = cleanFlight();
    const anomalies = deriveFlightAnomalies({
      ...base,
      releasedAtMs: 120,
      frameSamples: {
        ...base.frameSamples,
        maxGapMs: 80,
        longGaps: [80],
        held: phase({ maxGapMs: 80, over30Count: 1 }),
        released: phase()
      }
    });
    expect(anomalies).toEqual([]);
  });

  it("classifies a long task overlapping flight start as opening-swallow risk", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      longTasks: [{ startMs: 920, durationMs: 180 }]
    });
    expect(anomalies.some((entry) => entry.includes("opening-swallow risk"))).toBe(true);
  });

  it("anchors the opening window at the hold release, not the status flip", () => {
    // Release at t0+200: a task at the release point is an opening risk; the
    // same task without a hold (release at t0) would be plain mid-flight.
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      releasedAtMs: 200,
      longTasks: [{ startMs: 1180, durationMs: 120 }]
    });
    expect(anomalies.some((entry) => entry.includes("opening-swallow risk"))).toBe(true);
  });

  it("reports hold-phase long tasks as absorbed, not as jank", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      releasedAtMs: 250,
      holdLongTasks: [{ startMs: 1010, durationMs: 180 }]
    });
    const line = anomalies.find((entry) => entry.includes("absorbed by the hold"));
    expect(line).toContain("long task 180ms");
    expect(line).toContain("not user-visible jank");
    expect(anomalies.some((entry) => entry.includes("opening-swallow"))).toBe(false);
  });

  it("keeps small hold-phase long tasks silent", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      releasedAtMs: 250,
      holdLongTasks: [{ startMs: 1010, durationMs: 60 }]
    });
    expect(anomalies).toEqual([]);
  });

  it("labels a large mid-flight long task without the opening tag", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      longTasks: [{ startMs: 1250, durationMs: 120 }]
    });
    expect(anomalies.some((entry) => entry.includes("long task 120ms mid-flight"))).toBe(true);
    expect(anomalies.some((entry) => entry.includes("opening-swallow"))).toBe(false);
  });

  it("ignores small mid-flight long tasks", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      longTasks: [{ startMs: 1250, durationMs: 60 }]
    });
    expect(anomalies).toEqual([]);
  });

  it("flags residual inline styles after COMPLETED", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      landing: {
        residualInlineTransforms: ["screen[1] (active) transform=translate3d(100%, 0px, 0px)"],
        offViewportAtRest: false,
        stuckStatuses: [],
        orphanedHolds: []
      }
    });
    expect(anomalies.some((entry) => entry.includes("residual inline style after COMPLETED"))).toBe(
      true
    );
  });

  it("flags the blank-viewport signature", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      landing: {
        residualInlineTransforms: [],
        offViewportAtRest: true,
        stuckStatuses: [],
        orphanedHolds: []
      }
    });
    expect(anomalies.some((entry) => entry.includes("blank-viewport signature"))).toBe(true);
  });

  it("flags stuck transitional statuses", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      landing: {
        residualInlineTransforms: [],
        offViewportAtRest: false,
        stuckStatuses: ["PUSHING"],
        orphanedHolds: []
      }
    });
    expect(anomalies.some((entry) => entry.includes("stuck >10s: PUSHING"))).toBe(true);
  });

  it("flags an unclassifiable driver", () => {
    const anomalies = deriveFlightAnomalies({ ...cleanFlight(), driver: "unknown" });
    expect(anomalies.some((entry) => entry.includes("driver could not be classified"))).toBe(true);
  });
});

describe("deriveReportAnomalies", () => {
  const base = {
    forcePin: null,
    legacyLocalForcePin: null,
    clearedForcePin: null,
    emulationSuspected: false,
    platform: "MacIntel",
    stuckFlightOpen: false,
    flightAnomalies: [] as string[][]
  };

  it("is empty for a clean session", () => {
    expect(deriveReportAnomalies(base)).toEqual([]);
  });

  it("flags an active force pin", () => {
    const anomalies = deriveReportAnomalies({ ...base, forcePin: "raf@1700000000000" });
    expect(
      anomalies.some((entry) =>
        entry.includes("active force pin flemo:motion-driver-force=raf@1700000000000")
      )
    ).toBe(true);
  });

  it("flags a pin that was cleared between attach and report", () => {
    const anomalies = deriveReportAnomalies({ ...base, clearedForcePin: "raf" });
    expect(anomalies.some((entry) => entry.includes("was present at attach"))).toBe(true);
  });

  it("does not double-report a cleared pin while an active pin exists", () => {
    const anomalies = deriveReportAnomalies({
      ...base,
      forcePin: "css@1700000000000",
      clearedForcePin: "raf"
    });
    expect(anomalies.filter((entry) => entry.includes("flemo:motion-driver-force"))).toHaveLength(
      1
    );
  });

  it("flags the legacy localStorage pin at report level", () => {
    const anomalies = deriveReportAnomalies({ ...base, legacyLocalForcePin: "raf" });
    expect(anomalies.some((entry) => entry.includes("legacy localStorage driver pin"))).toBe(true);
  });

  it("flags DevTools device emulation, with the Windows caveat only on Windows", () => {
    const mac = deriveReportAnomalies({ ...base, emulationSuspected: true });
    expect(mac.some((entry) => entry.includes("device emulation suspected"))).toBe(true);
    expect(mac.some((entry) => entry.includes("Windows touch"))).toBe(false);

    const win = deriveReportAnomalies({ ...base, emulationSuspected: true, platform: "Win32" });
    expect(win.some((entry) => entry.includes("Windows touch"))).toBe(true);
  });

  it("flags a stuck open flight", () => {
    const anomalies = deriveReportAnomalies({ ...base, stuckFlightOpen: true });
    expect(anomalies.some((entry) => entry.includes("still transitional"))).toBe(true);
  });

  it("surfaces a blank-viewport flight at report level", () => {
    const anomalies = deriveReportAnomalies({
      ...base,
      flightAnomalies: [
        ["screen resting at from-pose while COMPLETED+active (blank-viewport signature)"]
      ]
    });
    expect(anomalies.some((entry) => entry.includes("blank-viewport signature"))).toBe(true);
  });
});

// The closing tail is not a stall. Counting the frames after the last animation
// FINISHED made a ~50ms "motion stalled" fire on every healthy flight (measured
// on plen 2026-08-20: 10 of 10, always exactly 3 frames) — a constant reading
// that would mask the real stalls this rule exists to surface.
describe("closing tail", () => {
  it("is not reported as a stall", () => {
    const flight = cleanFlight();
    flight.motion = { ...flight.motion, stalledFrames: 0, longestStallMs: 0, tailFrames: 3 };
    expect(deriveFlightAnomalies(flight).join(" ")).not.toContain("stalled");
  });

  it("still reports a stall that happened while an animation was running", () => {
    const flight = cleanFlight();
    flight.motion = { ...flight.motion, stalledFrames: 3, longestStallMs: 50, tailFrames: 0 };
    expect(deriveFlightAnomalies(flight).join(" ")).toContain("stalled");
  });
});
