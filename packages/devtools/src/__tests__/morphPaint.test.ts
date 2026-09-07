import { afterEach, describe, expect, it } from "vitest";

import { deriveFlightAnomalies } from "../anomalies";
import { createMorphProbeState, morphActivity, sampleMorphPaint } from "../morphProbe";

import type { FlightAnomalyInput } from "../anomalies";

// THE TWO THINGS THE RECORDER WATCHED HAPPEN AND HAD NOTHING TO SAY ABOUT.
//
// Both shipped on this repository's own playground and were found by eye, days
// apart: a morph whose `exit` pose left the departing page painting for the
// whole flight (a push covers it, a pop uncovers it as the card lands), and a
// `<Part>` pinned at the width it rests at on the OTHER side of the flight, so
// it sat 32px narrower than the card carrying it for a whole drag with the
// frosted feed showing through the gap.
//
// Neither is visible in roles, gaps, holds or residue, which is everything the
// recorder measured before.
const flight = (over: Partial<FlightAnomalyInput["morphs"]>): FlightAnomalyInput["morphs"] => ({
  registered: 2,
  pairable: ["card"],
  flew: ["card"],
  skipped: [],
  camera: false,
  ghosts: 0,
  strandedRoles: 0,
  strandedStandIns: 0,
  strandedGhosts: 0,
  leakedSheetRules: 0,
  layerResidue: 0,
  duplicatedKeys: [],
  departureFrames: 0,
  departureMaxOpacity: 0,
  partGapPx: 0,
  partGapName: null,
  partGapFrames: 0,
  ...over
});

// The shape the anomaly pass reads, borrowed from anomalies.test.ts so this
// file only varies the two fields it is about.
const input = (morphs: FlightAnomalyInput["morphs"]): FlightAnomalyInput => ({
  t0Ms: 1000,
  t1Ms: 1400,
  driver: "compiled",
  frameSamples: {
    count: 24,
    medianGapMs: 16.7,
    maxGapMs: 18.2,
    longGaps: [],
    held: { count: 0, medianGapMs: 0, maxGapMs: 0, over30Count: 0 },
    released: { count: 24, medianGapMs: 16.7, maxGapMs: 18.2, over30Count: 0 }
  },
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
    holdReassertedAtMs: null,
    firstAnimationAtMs: 4
  },
  images: {
    loadingAtStart: 0,
    addedDuringFlight: 0,
    completedDuringFlight: 0,
    heldDuringFlight: 0,
    completedUnheld: 0
  },
  morphs,
  tripwires: []
});

const html = (markup: string) => {
  document.body.innerHTML = markup;
};

describe("what the flight painted", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("counts a departure that is still on glass", () => {
    html(`<div data-flemo-morph="exit" style="opacity: 1"></div>`);
    const state = createMorphProbeState([]);
    sampleMorphPaint(state);
    sampleMorphPaint(state);
    sampleMorphPaint(state);
    const activity = morphActivity(state, true);
    expect(activity.departureFrames).toBe(3);
    expect(activity.departureMaxOpacity).toBeCloseTo(1);
    expect(deriveFlightAnomalies(input(flight(activity))).join(" ")).toContain("kept painting");
  });

  it("stays quiet for the cut every preset writes", () => {
    html(`<div data-flemo-morph="exit" style="opacity: 0"></div>`);
    const state = createMorphProbeState([]);
    sampleMorphPaint(state);
    sampleMorphPaint(state);
    sampleMorphPaint(state);
    expect(morphActivity(state, true).departureFrames).toBe(0);
  });

  it("reports a part narrower than the box carrying it", () => {
    // jsdom reports zero-sized rects, so the widths are stubbed on the
    // prototypes the sampler reads. The rule under test is the comparison.
    html(
      `<div data-flemo-morph="enter" id="box"><div data-flemo-part-name="story-copy" id="part"></div></div>`
    );
    const box = document.getElementById("box")!;
    const part = document.getElementById("part")!;
    box.getBoundingClientRect = () => ({ width: 346 }) as DOMRect;
    part.getBoundingClientRect = () => ({ width: 314 }) as DOMRect;
    const state = createMorphProbeState([]);
    sampleMorphPaint(state);
    sampleMorphPaint(state);
    sampleMorphPaint(state);
    const activity = morphActivity(state, true);
    expect(activity.partGapFrames).toBe(3);
    expect(Math.round(activity.partGapPx)).toBe(32);
    expect(activity.partGapName).toBe("story-copy");
    expect(deriveFlightAnomalies(input(flight(activity))).join(" ")).toContain(
      "narrower than the box"
    );
  });
});
