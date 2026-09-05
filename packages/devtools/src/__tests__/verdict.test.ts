import { describe, expect, it } from "vitest";

import { deriveVerdict } from "../verdict";

import type { FlightRecord, Precondition } from "../types";

// THE VERDICT LEADS THE REPORT, so it has to refuse to summarise data from a
// session that was not allowed to produce evidence — that refusal is the whole
// reason it exists.

const flight = (over: Partial<FlightRecord> = {}): FlightRecord =>
  ({
    id: "flight-1",
    kind: "PUSH",
    t0: { ms: 0, iso: "" },
    t1: { ms: 400, iso: "" },
    durationMs: 400,
    driver: "compiled",
    participants: { screens: 2, bars: 0, decorators: 1, parts: 0 },
    holds: { kind: null, releasedAtMs: null },
    frameSamples: {
      count: 24,
      medianGapMs: 16.7,
      maxGapMs: 18,
      longGaps: [],
      held: { count: 0, medianGapMs: 0, maxGapMs: 0, over30Count: 0 },
      released: { count: 24, medianGapMs: 16.7, maxGapMs: 18, over30Count: 0 }
    },
    motion: {
      sampledFrames: 24,
      stalledFrames: 0,
      longestStallMs: 0,
      pausedAfterRelease: false,
      holdReassertedAtMs: null,
      tailFrames: 3,
      firstAnimationAtMs: 6
    },
    images: {
      loadingAtStart: 0,
      addedDuringFlight: 0,
      completedDuringFlight: 0,
      heldDuringFlight: 0,
      completedUnheld: 0
    },
    morphs: {
      registered: 0,
      pairable: [],
      flew: [],
      skipped: [],
      camera: false,
      ghosts: 0,
      strandedRoles: 0,
      strandedStandIns: 0,
      strandedGhosts: 0,
      leakedSheetRules: 0,
      layerResidue: 0,
      duplicatedKeys: []
    },
    tripwires: [],
    input: { trusted: 1, synthetic: 0, pointerTypes: ["touch"] },
    longTasks: [],
    holdLongTasks: [],
    landing: {
      residualInlineTransforms: [],
      offViewportAtRest: false,
      stuckStatuses: [],
      orphanedHolds: []
    },
    anomalies: [],
    ...over
  }) as FlightRecord;

const ok: Precondition[] = [{ id: "display-cadence", status: "ok", detail: "60Hz" }];
const observation = { longTasks: true, elementAnimations: true, animationEvents: true };

describe("deriveVerdict", () => {
  it("leads with a refusal when a precondition failed", () => {
    const lines = deriveVerdict({
      preconditions: [
        ...ok,
        { id: "build-mode", status: "violated", detail: "dev" },
        { id: "machine-idle", status: "violated", detail: "busy" }
      ],
      flights: [flight()],
      observation
    });
    expect(lines[0]).toContain("NOT EVIDENCE");
    expect(lines[0]).toContain("build-mode, machine-idle");
  });

  it("says plainly when nothing was recorded, and why that can happen", () => {
    const lines = deriveVerdict({ preconditions: ok, flights: [], observation });
    expect(lines[lines.length - 1]).toContain("attached after the one you meant to measure");
  });

  it("distrusts its own animation channel when it never fired", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      flights: [flight()],
      observation: { ...observation, animationEvents: false }
    });
    expect(lines.some((line) => line.includes("unmeasured rather than as clean"))).toBe(true);
  });

  it("summarises the session with the median and the worst gap", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      flights: [flight(), flight({ id: "flight-2", durationMs: 600 })],
      observation
    });
    expect(lines[0]).toContain("2 flight(s) recorded");
    expect(lines[0]).toContain("Median duration 600ms");
  });

  it("separates a flight that stopped moving from one that dropped frames", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      flights: [
        flight({
          motion: { ...flight().motion, longestStallMs: 250, stalledFrames: 15 }
        })
      ],
      observation
    });
    expect(lines.some((line) => line.includes("STOPPED MOVING"))).toBe(true);
    expect(lines.some((line) => line.includes("not at the frame budget"))).toBe(true);
  });

  it("names the shared elements that never flew", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      flights: [
        flight({
          morphs: { ...flight().morphs, pairable: ["hero"], skipped: ["hero"] }
        })
      ],
      observation
    });
    const line = lines.find((entry) => entry.includes("did NOT fly"));
    expect(line).toContain("hero");
    expect(line).toContain("silent by nature");
  });

  it("puts a duplicated pairing key on the consuming app", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      flights: [flight({ morphs: { ...flight().morphs, duplicatedKeys: ["card"] } })],
      observation
    });
    expect(lines.some((line) => line.includes("not in the library"))).toBe(true);
  });

  it("counts the tripwire hits and points at the flights that carry them", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      flights: [
        flight({
          tripwires: [{ kind: "animation-cancel", atMs: 12, detail: "x" }]
        })
      ],
      observation
    });
    expect(lines.some((line) => line.includes("1 tripwire hit(s)"))).toBe(true);
  });

  it("declares a clean session clean, and says what is left", () => {
    const lines = deriveVerdict({ preconditions: ok, flights: [flight()], observation });
    expect(lines[lines.length - 1]).toContain("this session is clean");
    expect(lines[lines.length - 1]).toContain("blindSpots");
  });

  it("never calls a session clean when a precondition failed", () => {
    const lines = deriveVerdict({
      preconditions: [{ id: "build-mode", status: "violated", detail: "dev" }],
      flights: [flight()],
      observation
    });
    expect(lines.some((line) => line.includes("this session is clean"))).toBe(false);
  });
});
