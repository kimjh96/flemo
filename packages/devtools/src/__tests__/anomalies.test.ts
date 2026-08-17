import { describe, expect, it } from "vitest";

import { deriveFlightAnomalies, deriveReportAnomalies } from "../anomalies";

import type { FlightAnomalyInput } from "../anomalies";

const cleanFlight = (): FlightAnomalyInput => ({
  t0Ms: 1000,
  t1Ms: 1400,
  driver: "compiled",
  frameSamples: { count: 24, medianGapMs: 16.7, maxGapMs: 18.2, longGaps: [] },
  playerGaps: null,
  longTasks: [],
  landing: { residualInlineTransforms: [], offViewportAtRest: false, stuckStatuses: [] }
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

  it("flags main-thread rAF gaps, softened for compiled flights", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      frameSamples: { count: 24, medianGapMs: 16.7, maxGapMs: 55, longGaps: [41, 55] }
    });
    const line = anomalies.find((entry) => entry.includes("main-thread rAF gap"));
    expect(line).toContain("up to 55ms ×2");
    expect(line).toContain("can still present cleanly");
  });

  it("does not soften main-thread gaps for player flights", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      driver: "player",
      frameSamples: { count: 24, medianGapMs: 16.7, maxGapMs: 55, longGaps: [55] }
    });
    const line = anomalies.find((entry) => entry.includes("main-thread rAF gap"));
    expect(line).not.toContain("can still present cleanly");
  });

  it("classifies a long task overlapping flight start as opening-swallow risk", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      longTasks: [{ startMs: 920, durationMs: 180 }]
    });
    expect(anomalies.some((entry) => entry.includes("opening-swallow risk"))).toBe(true);
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
        stuckStatuses: []
      }
    });
    expect(anomalies.some((entry) => entry.includes("residual inline style after COMPLETED"))).toBe(
      true
    );
  });

  it("flags the blank-viewport signature", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      landing: { residualInlineTransforms: [], offViewportAtRest: true, stuckStatuses: [] }
    });
    expect(anomalies.some((entry) => entry.includes("blank-viewport signature"))).toBe(true);
  });

  it("flags stuck transitional statuses", () => {
    const anomalies = deriveFlightAnomalies({
      ...cleanFlight(),
      landing: {
        residualInlineTransforms: [],
        offViewportAtRest: false,
        stuckStatuses: ["PUSHING"]
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
