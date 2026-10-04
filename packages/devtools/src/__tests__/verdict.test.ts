import { describe, expect, it } from "vitest";

import { deriveVerdict } from "../verdict";

import type { TransitionRecord, Precondition } from "../types";

// THE VERDICT LEADS THE REPORT, so it has to refuse to summarise data from a
// session that was not allowed to produce evidence — that refusal is the whole
// reason it exists.

const transition = (over: Partial<TransitionRecord> = {}): TransitionRecord =>
  ({
    id: "transition-1",
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
      addedDuringTransition: 0,
      completedDuringTransition: 0,
      heldDuringTransition: 0,
      completedUnheld: 0
    },
    morphs: {
      registered: 0,
      pairable: [],
      moved: [],
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
    endAudit: {
      residualInlineTransforms: [],
      offViewportAtRest: false,
      stuckStatuses: [],
      orphanedHolds: []
    },
    anomalies: [],
    ...over
  }) as TransitionRecord;

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
      transitions: [transition()],
      observation
    });
    expect(lines[0]).toContain("NOT EVIDENCE");
    expect(lines[0]).toContain("build-mode, machine-idle");
  });

  it("says plainly when nothing was recorded, and why that can happen", () => {
    const lines = deriveVerdict({ preconditions: ok, transitions: [], observation });
    expect(lines[lines.length - 1]).toContain("attached after the one you meant to measure");
  });

  it("distrusts its own animation channel when it never fired", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      transitions: [transition()],
      observation: { ...observation, animationEvents: false }
    });
    expect(lines.some((line) => line.includes("unmeasured rather than as clean"))).toBe(true);
  });

  it("summarises the session with the median and the worst gap", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      transitions: [transition(), transition({ id: "transition-2", durationMs: 600 })],
      observation
    });
    expect(lines[0]).toContain("2 transition(s) recorded");
    expect(lines[0]).toContain("Median duration 600ms");
  });

  it("separates a transition that stopped moving from one that dropped frames", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      transitions: [
        transition({
          motion: { ...transition().motion, longestStallMs: 250, stalledFrames: 15 }
        })
      ],
      observation
    });
    expect(lines.some((line) => line.includes("STOPPED MOVING"))).toBe(true);
    expect(lines.some((line) => line.includes("not at the frame budget"))).toBe(true);
  });

  it("names the shared elements that never moved", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      transitions: [
        transition({
          morphs: { ...transition().morphs, pairable: ["hero"], skipped: ["hero"] }
        })
      ],
      observation
    });
    const line = lines.find((entry) => entry.includes("did NOT move"));
    expect(line).toContain("hero");
    expect(line).toContain("silent by nature");
  });

  it("puts a duplicated pairing key on the consuming app", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      transitions: [transition({ morphs: { ...transition().morphs, duplicatedKeys: ["card"] } })],
      observation
    });
    expect(lines.some((line) => line.includes("not in the library"))).toBe(true);
  });

  it("counts the tripwire hits and points at the transitions that carry them", () => {
    const lines = deriveVerdict({
      preconditions: ok,
      transitions: [
        transition({
          tripwires: [{ kind: "animation-cancel", atMs: 12, detail: "x" }]
        })
      ],
      observation
    });
    expect(lines.some((line) => line.includes("1 tripwire hit(s)"))).toBe(true);
  });

  it("declares a clean session clean, and says what is left", () => {
    const lines = deriveVerdict({ preconditions: ok, transitions: [transition()], observation });
    expect(lines[lines.length - 1]).toContain("this session is clean");
    expect(lines[lines.length - 1]).toContain("blindSpots");
  });

  it("never calls a session clean when a precondition failed", () => {
    const lines = deriveVerdict({
      preconditions: [{ id: "build-mode", status: "violated", detail: "dev" }],
      transitions: [transition()],
      observation
    });
    expect(lines.some((line) => line.includes("this session is clean"))).toBe(false);
  });
});
