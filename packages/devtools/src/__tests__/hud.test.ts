import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachDevtoolsHud } from "../hud";

import type { DevtoolsHudHandle } from "../hud";
import type { FlemoReport, FlightRecord, FlightRecorderHandle } from "../types";

// A PHONE HAS NO CONSOLE.
//
// Every hard defect in this project's history was finally pinned on a real
// device, and every one of those investigations began by hand-building a box
// that prints numbers on the screen and deleting it when the round was over.
// This is that box, kept — and the rules it has to keep are the ones the panel
// keeps: never repaint during a flight, never animate, and be readable in a
// photograph of the device.

const flight = (over: Partial<FlightRecord> = {}): FlightRecord =>
  ({
    id: "flight-1",
    kind: "POP",
    durationMs: 412,
    driver: "compiled",
    bucket: undefined,
    holds: { kind: "park", releasedAtMs: 118 },
    frameSamples: {
      count: 24,
      medianGapMs: 16.7,
      maxGapMs: 33.4,
      longGaps: [33.4],
      held: { count: 6, medianGapMs: 16.7, maxGapMs: 20, over30Count: 0 },
      released: { count: 18, medianGapMs: 16.7, maxGapMs: 33.4, over30Count: 1 }
    },
    motion: {
      sampledFrames: 18,
      stalledFrames: 0,
      longestStallMs: 0,
      pausedAfterRelease: false,
      holdReassertedAtMs: null,
      tailFrames: 3,
      firstAnimationAtMs: 22
    },
    morphs: {
      registered: 2,
      pairable: ["hero"],
      flew: ["hero"],
      skipped: [],
      camera: true,
      ghosts: 1,
      strandedRoles: 0,
      strandedStandIns: 0,
      strandedGhosts: 0,
      leakedSheetRules: 0,
      layerResidue: 0,
      duplicatedKeys: []
    },
    input: { trusted: 1, synthetic: 0, pointerTypes: ["touch"] },
    longTasks: [],
    anomalies: [],
    ...over
  }) as unknown as FlightRecord;

const report = (over: Partial<FlemoReport> = {}): FlemoReport =>
  ({
    generatedAt: "",
    version: "3",
    verdict: [],
    environment: { rafCadence: { medianGapMs: 16.7, sampleCount: 20 } },
    preconditions: [],
    overrides: { active: {}, warnings: [] },
    flights: [flight()],
    comparison: [],
    previousSession: null,
    anomalies: [],
    blindSpots: [],
    judgingProtocol: [],
    ...over
  }) as unknown as FlemoReport;

let hud: DevtoolsHudHandle | null = null;
const marks: (string | null)[] = [];

const recorder = (read: () => FlemoReport): FlightRecorderHandle => ({
  report: read,
  detach: vi.fn(),
  mark: (bucket) => {
    marks.push(bucket);
    return bucket;
  }
});

const box = (): HTMLElement => {
  const host = document.querySelector("[data-flemo-devtools-panel]");
  const node = host?.shadowRoot?.querySelector(".hud");
  if (!(node instanceof HTMLElement)) throw new Error("hud is not mounted");
  return node;
};

const screenInFlight = (): Element => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", "POPPING");
  document.body.appendChild(screen);
  return screen;
};

beforeEach(() => {
  vi.useFakeTimers();
  marks.length = 0;
});

afterEach(() => {
  hud?.detach();
  hud = null;
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("the on-device readout", () => {
  it("shows one line a photograph can carry", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report()) });
    expect(box().textContent).toBe("POP 412ms  gap 33.4  drop 1  ok");
  });

  it("says so plainly before anything has flown", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report({ flights: [] })) });
    expect(box().textContent).toContain("no flight yet");
  });

  it("marks a flight that carries an anomaly, in text as well as in colour", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() => report({ flights: [flight({ anomalies: ["a", "b"] })] }))
    });
    expect(box().textContent).toContain("!2");
    expect(box().getAttribute("data-alarm")).toBe("true");
  });

  it("says BLOCKED when the session cannot produce evidence", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() =>
        report({ preconditions: [{ id: "build-mode", status: "violated", detail: "dev" }] })
      ),
      initialExpanded: true
    });
    expect(box().textContent).toContain("BLOCKED  build-mode");
    expect(box().getAttribute("data-blocked")).toBe("true");
  });

  it("opens on a tap into the block a device round actually asks for", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report()) });
    box().dispatchEvent(new Event("pointerdown"));
    box().dispatchEvent(new Event("pointerup"));

    const text = box().textContent ?? "";
    expect(text).toContain("frames  n18");
    expect(text).toContain("motion  stall 0ms tail 3 start +22ms");
    expect(text).toContain("hold    park rel 118ms");
    expect(text).toContain("morph   1 flew cam");
    expect(text).toContain("input   touch");
  });

  it("names a shared element that did not fly, where a device can read it", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() =>
        report({
          flights: [
            flight({
              morphs: { ...flight().morphs, flew: [], skipped: ["hero"] },
              anomalies: ["shared element(s) did not fly: hero"]
            })
          ]
        })
      ),
      initialExpanded: true
    });
    const text = box().textContent ?? "";
    expect(text).toContain("SKIPPED 1 (hero)");
    expect(text).toContain("! shared element(s) did not fly");
  });

  it("calls out script-driven input, which proves nothing about a finger", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() =>
        report({ flights: [flight({ input: { trusted: 0, synthetic: 3, pointerTypes: [] } })] })
      ),
      initialExpanded: true
    });
    expect(box().textContent).toContain("SYNTHETIC 3");
  });

  it("shows the idle cadence when there is no flight to describe", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() => report({ flights: [] })),
      initialExpanded: true
    });
    expect(box().textContent).toContain("rAF 16.7ms");
  });

  it("NEVER repaints while a flight is in progress", () => {
    let flights = [flight()];
    hud = attachDevtoolsHud({ recorder: recorder(() => report({ flights })) });
    const before = box().textContent;

    const screen = screenInFlight();
    flights = [flight({ kind: "PUSH", durationMs: 999 })];
    vi.advanceTimersByTime(2000);
    expect(box().textContent).toBe(before);

    screen.remove();
    vi.advanceTimersByTime(600);
    expect(box().textContent).toContain("PUSH 999ms");
  });

  it("cycles the comparison bucket on a long press, and back off again", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report()), buckets: ["A", "B"] });
    const press = () => {
      box().dispatchEvent(new Event("pointerdown"));
      vi.advanceTimersByTime(500);
      box().dispatchEvent(new Event("pointerup"));
    };
    press();
    press();
    press();
    expect(marks).toEqual(["A", "B", null]);
  });

  it("does not also toggle the detail when a press was a long one", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report()) });
    const compact = box().textContent;
    box().dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(500);
    box().dispatchEvent(new Event("pointerup"));
    expect(box().textContent).toBe(compact);
  });

  it("abandons a press the browser took away", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report()) });
    box().dispatchEvent(new Event("pointerdown"));
    box().dispatchEvent(new Event("pointercancel"));
    vi.advanceTimersByTime(1000);
    expect(marks).toEqual([]);
  });

  it("survives a recorder that throws rather than taking its own timer down", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() => {
        throw new Error("no");
      })
    });
    expect(box().textContent).toContain("no flight yet");
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });

  it("is idempotent while mounted and takes itself down cleanly", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report()) });
    expect(attachDevtoolsHud()).toBe(hud);
    hud.detach();
    hud.detach();
    expect(document.querySelector("[data-flemo-devtools-panel]")).toBeNull();
    hud = null;
  });

  it("detaches a recorder it owns, and leaves one it was handed", () => {
    const handed = recorder(() => report());
    const own = attachDevtoolsHud({ recorder: handed });
    own.detach();
    expect(handed.detach).not.toHaveBeenCalled();
  });

  it("carries no transition and no keyframe in its stylesheet", () => {
    hud = attachDevtoolsHud({ recorder: recorder(() => report()) });
    const css =
      document.querySelector("[data-flemo-devtools-panel]")?.shadowRoot?.querySelector("style")
        ?.textContent ?? "";
    expect(css).not.toContain("@keyframes");
    expect(/(^|[^-])transition\s*:/.test(css)).toBe(false);
  });

  // A REPORT WHOSE SHAPE HAS MOVED must not take the readout down. Every field
  // here is read as possibly-absent for the same reason the panel's are: the
  // schema grows, and an instrument that throws on a missing key is worse than
  // no instrument on the device where it is hardest to replace.
  it("renders a flight with nothing in it rather than throwing", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(
        () =>
          ({
            flights: [{ id: "flight-1" }]
          }) as unknown as FlemoReport
      ),
      initialExpanded: true
    });
    const text = box().textContent ?? "";
    expect(text).toContain("frames  n0");
    expect(text).toContain("motion  stall 0ms tail 0 start +?ms");
    expect(text).toContain("hold    none rel -ms");
    expect(box().getAttribute("data-alarm")).toBe("false");
  });

  it("renders an empty report rather than throwing", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() => ({}) as unknown as FlemoReport),
      initialExpanded: true
    });
    expect(box().textContent).toContain("no flight yet");
    expect(box().textContent).toContain("rAF 0ms");
  });

  it("says nothing about input or shared elements a flight did not carry", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(
        () =>
          ({
            flights: [
              {
                id: "flight-1",
                kind: "PUSH",
                durationMs: 100,
                morphs: { pairable: [], flew: [], skipped: [], camera: false }
              }
            ]
          }) as unknown as FlemoReport
      ),
      initialExpanded: true
    });
    const text = box().textContent ?? "";
    expect(text).not.toContain("morph  ");
    expect(text).not.toContain("input  ");
  });

  it("carries the armed bucket on the line it shows", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() => report({ flights: [flight({ bucket: "B" })] }))
    });
    expect(box().textContent).toContain("[B]");
  });

  it("takes down a recorder it attached itself", () => {
    // No recorder handed in and no window.flemo to adopt: the readout owns one.
    hud = attachDevtoolsHud();
    hud.detach();
    hud = null;
    expect((window as unknown as { flemo?: unknown }).flemo).toBeUndefined();
  });

  it("is inert where there is no document to mount into", () => {
    const original = globalThis.document;
    // @ts-expect-error deliberately removing the global for this case
    delete globalThis.document;
    try {
      const inert = attachDevtoolsHud();
      expect(() => inert.detach()).not.toThrow();
    } finally {
      globalThis.document = original;
    }
  });

  // A pair the runtime had already staged when the flight opened is proved by
  // its role, not by the grouping of ends still sitting in their screens, so
  // the count of what FLEW can exceed that grouping. Printed as a fraction it
  // read "3/0" on a device, which looks like a failure and is not one.
  it("counts what flew without a denominator that can be smaller", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() =>
        report({
          flights: [
            flight({
              morphs: { ...flight().morphs, pairable: [], flew: ["a", "b", "c"] }
            })
          ]
        })
      ),
      initialExpanded: true
    });
    const text = box().textContent ?? "";
    expect(text).toContain("morph   3 flew");
    expect(text).not.toContain("/0");
  });

  it("says nothing about a camera on a flight that drove no screen", () => {
    hud = attachDevtoolsHud({
      recorder: recorder(() =>
        report({
          flights: [flight({ morphs: { ...flight().morphs, camera: false } })]
        })
      ),
      initialExpanded: true
    });
    const text = box().textContent ?? "";
    expect(text).toContain("morph   1 flew");
    expect(text).not.toContain("cam");
  });
});
