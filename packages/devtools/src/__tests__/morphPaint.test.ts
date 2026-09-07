import { afterEach, describe, expect, it, vi } from "vitest";

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
    vi.restoreAllMocks();
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

  it("reads a painting departure through whatever the host reports", () => {
    // Three answers the sampler has to tell apart, and only the first counts:
    // an empty string is a host that computed nothing (read as painting), a
    // value that is not a number is a host that cannot answer, and a hidden
    // end is the cut working.
    html(
      `<div data-flemo-morph="exit" id="a"></div>` +
        `<div data-flemo-morph="exit" id="b"></div>` +
        `<div data-flemo-morph="exit" id="c"></div>`
    );
    vi.spyOn(globalThis, "getComputedStyle").mockImplementation(
      (element) => ({ opacity: { a: "", b: "banana", c: "0" }[element.id] }) as CSSStyleDeclaration
    );
    const state = createMorphProbeState([]);
    sampleMorphPaint(state);
    expect(state.departureFrames).toBe(1);
    expect(state.departureMaxOpacity).toBeCloseTo(1);
  });

  it("keeps the worst departure it saw, not the last", () => {
    html(
      `<div data-flemo-morph="exit" id="a" style="opacity: 0.9"></div>` +
        `<div data-flemo-morph="exit" id="b" style="opacity: 0.3"></div>`
    );
    const state = createMorphProbeState([]);
    sampleMorphPaint(state);
    expect(state.departureFrames).toBe(2);
    expect(state.departureMaxOpacity).toBeCloseTo(0.9);
  });

  it("says nothing where the host computes no styles at all", () => {
    html(`<div data-flemo-morph="exit" style="opacity: 1"></div>`);
    const host = globalThis as { getComputedStyle?: typeof getComputedStyle };
    const real = host.getComputedStyle;
    delete host.getComputedStyle;
    const state = createMorphProbeState([]);
    try {
      expect(() => sampleMorphPaint(state)).not.toThrow();
    } finally {
      host.getComputedStyle = real;
    }
    expect(state.departureFrames).toBe(0);
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

  it("measures nothing against a box with no width, and keeps the widest gap", () => {
    // A flyer the engine cannot measure is an engine that cannot answer, not a
    // part that fits; a part within two pixels of its box is the rounding the
    // rule exists to ignore; and of two real gaps the sampler keeps the worse.
    html(
      `<div data-flemo-morph="enter" id="empty"><div data-flemo-part-name="ignored"></div></div>` +
        `<div data-flemo-morph="enter" id="box">` +
        `<div data-flemo-part-name="rounding" id="near"></div>` +
        `<div data-flemo-part-name="copy" id="wide"></div>` +
        `<div data-flemo-part-name="chrome" id="less"></div>` +
        `</div>`
    );
    const width = (id: string, value: number) => {
      document.getElementById(id)!.getBoundingClientRect = () => ({ width: value }) as DOMRect;
    };
    width("empty", 0);
    width("box", 346);
    width("near", 345);
    width("wide", 314);
    width("less", 330);
    const state = createMorphProbeState([]);
    sampleMorphPaint(state);
    expect(state.partGapFrames).toBe(2);
    expect(Math.round(state.partGapPx)).toBe(32);
    expect(state.partGapName).toBe("copy");
  });

  it("names the part it could not name", () => {
    // The name is read off the element, so a flight recorded from a host that
    // dropped the attribute still has a gap worth reporting.
    const anomalies = deriveFlightAnomalies(
      input(flight({ partGapFrames: 4, partGapPx: 32, partGapName: null }))
    ).join(" ");
    expect(anomalies).toContain('the part "?"');
  });
});
