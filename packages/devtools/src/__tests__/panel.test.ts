import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachDevtoolsPanel } from "../panel";

import { clear, el, setText, svgEl } from "../panel/dom";
import {
  DASH,
  environmentSummary,
  flightListSignature,
  formatBool,
  formatCount,
  formatGapMs,
  formatMs,
  formatText,
  releasedGapSeries
} from "../panel/format";

import type { DevtoolsPanelHandle } from "../panel";
import type { FlemoReport, FlightRecord, FlightRecorderHandle } from "../types";

// Fixtures are cast rather than typed structurally ON PURPOSE: the report
// schema keeps growing, and the panel's contract is "render whatever arrives,
// never crash". Tests that had to be updated for every new recorder field
// would quietly stop testing that.
const flight = (over: Record<string, unknown> = {}): FlightRecord =>
  ({
    id: "flight-1",
    kind: "PUSH",
    t0: { ms: 100, iso: "2026-08-18T09:00:00.000Z" },
    t1: { ms: 700, iso: "2026-08-18T09:00:00.600Z" },
    durationMs: 600.4,
    driver: "compiled",
    participants: { screens: 2, bars: 1, decorators: 0, parts: 0 },
    holds: { kind: "park-under", releasedAtMs: 120 },
    frameSamples: {
      count: 36,
      medianGapMs: 16.7,
      maxGapMs: 17.2,
      longGaps: [],
      held: { count: 7, medianGapMs: 18.1, maxGapMs: 45, over30Count: 1 },
      released: { count: 29, medianGapMs: 16.7, maxGapMs: 17.2, over30Count: 0 }
    },
    longTasks: [],
    holdLongTasks: [],
    landing: { residualInlineTransforms: [], offViewportAtRest: false, stuckStatuses: [] },
    anomalies: [],
    ...over
  }) as unknown as FlightRecord;

const report = (over: Record<string, unknown> = {}): FlemoReport =>
  ({
    generatedAt: "2026-08-18T09:00:00.000Z",
    version: "1",
    environment: {
      engine: "blink",
      devicePixelRatio: 2,
      viewport: { width: 1280, height: 720 },
      rafCadence: { medianGapMs: 16.67, sampleCount: 20 }
    },
    overrides: { active: {}, warnings: [] },
    flights: [],
    anomalies: [],
    blindSpots: ["present pipeline"],
    ...over
  }) as unknown as FlemoReport;

const stub = (read: () => FlemoReport): FlightRecorderHandle => ({
  report: read,
  detach: () => {},
  mark: () => null
});

let panel: DevtoolsPanelHandle | null = null;

const mount = (options?: Parameters<typeof attachDevtoolsPanel>[0]) => {
  panel = attachDevtoolsPanel(options);
  return panel;
};

const shadow = (): ShadowRoot => {
  const host = document.querySelector("[data-flemo-devtools-panel]");
  const root = host?.shadowRoot;
  if (!root) throw new Error("panel host is not mounted");
  return root;
};

const find = (selector: string): HTMLElement => {
  const node = shadow().querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
  return node;
};

// BY LABEL, NOT BY POSITION. The header grew an A/B button and every index in
// this file moved with it; a label survives the next one too.
const actButton = (label: string): HTMLButtonElement | undefined =>
  Array.from(shadow().querySelectorAll<HTMLButtonElement>(".act")).find(
    (button) => button.textContent === label
  );

const rows = (): HTMLElement[] => Array.from(shadow().querySelectorAll(".row"));
const texts = (selector: string): string[] =>
  Array.from(shadow().querySelectorAll(selector)).map((node) => node.textContent ?? "");

const mountScreen = (status: string): Element => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", status);
  document.body.appendChild(screen);
  return screen;
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  panel?.detach();
  panel = null;
  vi.useRealTimers();
  document.body.innerHTML = "";
  sessionStorage.clear();
  delete (window as unknown as { flemo?: unknown }).flemo;
});

describe("attachDevtoolsPanel — lifecycle", () => {
  it("mounts one shadow-rooted host, is idempotent, and cleans up on detach", () => {
    const handle = mount({ recorder: stub(() => report()) });
    expect(attachDevtoolsPanel()).toBe(handle);
    expect(document.querySelectorAll("[data-flemo-devtools-panel]")).toHaveLength(1);
    const host = document.querySelector("[data-flemo-devtools-panel]");
    expect(host?.shadowRoot).not.toBeNull();
    expect(getComputedStyle(host as Element).position).toBe("fixed");
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    handle.detach();
    expect(document.querySelector("[data-flemo-devtools-panel]")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    // Second detach is a no-op, and a fresh attach mounts again.
    handle.detach();
    panel = attachDevtoolsPanel({ recorder: stub(() => report()) });
    expect(panel).not.toBe(handle);
    expect(document.querySelectorAll("[data-flemo-devtools-panel]")).toHaveLength(1);
  });

  it("adopts this package's window.flemo without detaching it", () => {
    const detach = vi.fn();
    (window as unknown as { flemo: unknown }).flemo = {
      __flemoDevtools: true,
      report: () => report({ flights: [flight()] }),
      detach
    };
    mount({ initialOpen: true });
    vi.advanceTimersByTime(400);
    expect(rows()).toHaveLength(1);
    panel?.detach();
    expect(detach).not.toHaveBeenCalled();
  });

  it("attaches (and owns) a recorder when there is no usable global", () => {
    // A foreign window.flemo must not be mistaken for ours.
    (window as unknown as { flemo: unknown }).flemo = { theirs: true };
    mount();
    const installed = (window as unknown as { flemo?: { __flemoDevtools?: boolean } }).flemo;
    // The foreign occupant stands; the recorder still runs behind the panel.
    expect(installed?.__flemoDevtools).toBeUndefined();
    panel?.detach();
    panel = null;

    delete (window as unknown as { flemo?: unknown }).flemo;
    const owner = mount();
    expect(
      (window as unknown as { flemo?: { __flemoDevtools?: boolean } }).flemo?.__flemoDevtools
    ).toBe(true);
    owner.detach();
    expect((window as unknown as { flemo?: unknown }).flemo).toBeUndefined();
  });

  it("ignores a marked global that carries no report()", () => {
    (window as unknown as { flemo: unknown }).flemo = { __flemoDevtools: true };
    mount();
    // Fell through to its own recorder, which replaced the stub global.
    expect(typeof (window as unknown as { flemo?: { report?: unknown } }).flemo?.report).toBe(
      "function"
    );
  });

  it("survives a recorder whose report() throws", () => {
    mount({
      initialOpen: true,
      recorder: stub(() => {
        throw new Error("mid-edit recorder");
      })
    });
    vi.advanceTimersByTime(400);
    expect(find(".count").textContent).toBe("0");
    expect(find(".env").textContent).toBe(DASH);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("returns an inert handle without a document", () => {
    vi.stubGlobal("document", undefined);
    const inert = attachDevtoolsPanel();
    expect(() => inert.detach()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("attachDevtoolsPanel — toggle and list", () => {
  it("renders only the toggle when closed and opens on click", () => {
    mount({ recorder: stub(() => report({ flights: [flight(), flight({ id: "flight-2" })] })) });
    vi.advanceTimersByTime(2100);
    expect(find(".panel").hidden).toBe(true);
    expect(find(".count").textContent).toBe("2");
    expect(rows()).toHaveLength(0);

    find(".toggle").click();
    expect(find(".panel").hidden).toBe(false);
    expect(rows()).toHaveLength(2);
    // Newest first.
    expect(rows()[0]?.getAttribute("data-flight-id")).toBe("flight-2");

    find(".toggle").click();
    expect(find(".panel").hidden).toBe(true);
    find(".toggle").click();
    actButton("Close")?.click();
    expect(find(".panel").hidden).toBe(true);
  });

  it("shows the anomaly dot only when a flight carries anomalies", () => {
    let flights = [flight()];
    mount({ recorder: stub(() => report({ flights })) });
    vi.advanceTimersByTime(2100);
    expect(find(".dot").hidden).toBe(true);
    flights = [flight({ anomalies: ["long task 180ms overlapped flight start"] })];
    vi.advanceTimersByTime(2100);
    expect(find(".dot").hidden).toBe(false);
  });

  it("renders the empty state, the corner option and the flight row summary", () => {
    mount({ recorder: stub(() => report()), initialOpen: true, position: "bottom-left" });
    vi.advanceTimersByTime(400);
    expect(find(".toggle").getAttribute("data-corner")).toBe("bottom-left");
    expect(find(".list").textContent).toContain("no flights recorded yet");
    expect(find(".detail").textContent).toContain("select a flight");

    panel?.detach();
    panel = null;
    mount({
      recorder: stub(() =>
        report({ flights: [flight({ anomalies: ["a", "b"], durationMs: 600.4 })] })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    const row = rows()[0];
    expect(row?.textContent).toContain("PUSH");
    expect(row?.textContent).toContain("compiled");
    expect(row?.textContent).toContain("600ms");
    expect(row?.textContent).toContain("2 scr");
    expect(row?.querySelector(".n")?.classList.contains("bad")).toBe(true);
  });

  it("keeps the selection stable across refreshes and ignores re-selecting", () => {
    let flights = [flight(), flight({ id: "flight-2" })];
    mount({ recorder: stub(() => report({ flights })), initialOpen: true });
    vi.advanceTimersByTime(400);
    // Auto-selection follows the newest flight while nothing is selected.
    expect(find('.row[data-flight-id="flight-2"]').getAttribute("aria-selected")).toBe("true");

    find('.row[data-flight-id="flight-1"]').click();
    expect(find('.row[data-flight-id="flight-1"]').getAttribute("aria-selected")).toBe("true");
    find('.row[data-flight-id="flight-1"]').click(); // no-op re-select
    expect(find(".detail").textContent).toContain("flight-1");

    flights = [...flights, flight({ id: "flight-3" })];
    vi.advanceTimersByTime(400);
    expect(rows()).toHaveLength(3);
    expect(find('.row[data-flight-id="flight-1"]').getAttribute("aria-selected")).toBe("true");
    expect(find(".detail").textContent).toContain("flight-1");
  });

  it("does not re-render regions whose data did not change", () => {
    mount({ recorder: stub(() => report({ flights: [flight()] })), initialOpen: true });
    vi.advanceTimersByTime(400);
    const row = rows()[0];
    vi.advanceTimersByTime(1000);
    // Same node object: the list was not rebuilt.
    expect(rows()[0]).toBe(row);
  });

  it("ignores interactions after detach", () => {
    mount({ recorder: stub(() => report({ flights: [flight(), flight({ id: "flight-2" })] })) });
    find(".toggle").click();
    const stale = find('.row[data-flight-id="flight-1"]');
    panel?.detach();
    expect(() => stale.click()).not.toThrow();
  });
});

describe("attachDevtoolsPanel — the no-repaint-during-flight guarantee", () => {
  it("skips every refresh while a screen carries a transitional status", () => {
    let flights = [flight()];
    mount({ recorder: stub(() => report({ flights })), initialOpen: true });
    vi.advanceTimersByTime(400);
    expect(rows()).toHaveLength(1);

    const screen = mountScreen("PUSHING");
    flights = [flight(), flight({ id: "flight-2" })];
    vi.advanceTimersByTime(4000);
    // Frozen: neither the list nor the toggle badge moved.
    expect(rows()).toHaveLength(1);
    expect(find(".count").textContent).toBe("1");

    screen.setAttribute("data-flemo-status", "COMPLETED");
    vi.advanceTimersByTime(400);
    expect(rows()).toHaveLength(2);
    expect(find(".count").textContent).toBe("2");
  });

  it("defers a toggle click that lands mid-flight until the flight lands", () => {
    const screen = mountScreen("POPPING");
    mount({ recorder: stub(() => report({ flights: [flight()] })) });
    find(".toggle").click();
    expect(find(".panel").hidden).toBe(true);

    screen.setAttribute("data-flemo-status", "REPLACING");
    vi.advanceTimersByTime(2100);
    expect(find(".panel").hidden).toBe(true);

    screen.removeAttribute("data-flemo-status");
    vi.advanceTimersByTime(400);
    expect(find(".panel").hidden).toBe(false);
  });
});

describe("attachDevtoolsPanel — header", () => {
  it("summarizes the environment and chips the warnings, anomalies and overrides", () => {
    mount({
      recorder: stub(() =>
        report({
          overrides: {
            active: { "flemo:apply": "scrub" },
            warnings: ["flemo:apply=scrub — opt-in diagnostic active"]
          },
          anomalies: ["driver force pin ACTIVE"]
        })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    expect(find(".env").textContent).toBe("blink · dpr 2 · 1280×720 · rAF 16.7ms");
    expect(texts(".chip.warn")).toEqual(["flemo:apply=scrub — opt-in diagnostic active"]);
    expect(texts(".chip.bad")).toEqual(["driver force pin ACTIVE"]);
    expect(texts(".chip:not(.warn):not(.bad)")).toEqual(["flemo:apply=scrub"]);
    expect(find(".foot").textContent).toContain("present pipeline");
  });

  it("detaches from the header button", () => {
    mount({ recorder: stub(() => report()), initialOpen: true });
    vi.advanceTimersByTime(400);
    actButton("Detach")?.click();
    expect(document.querySelector("[data-flemo-devtools-panel]")).toBeNull();
    panel = null;
  });
});

describe("attachDevtoolsPanel — copy report JSON", () => {
  const setClipboard = (value: unknown) => {
    Object.defineProperty(navigator, "clipboard", { value, configurable: true });
  };
  const setExecCommand = (value: unknown) => {
    Object.defineProperty(document, "execCommand", { value, configurable: true });
  };

  afterEach(() => {
    setClipboard(undefined);
    setExecCommand(undefined);
  });

  const copyButton = () => actButton("Copy report JSON") ?? actButton("Copied ✓")!;

  it("writes the report through the async clipboard and restores its label", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    mount({ recorder: stub(() => report({ flights: [flight()] })), initialOpen: true });
    vi.advanceTimersByTime(400);
    copyButton()?.click();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"flight-1"'));
    await flushMicrotasks();
    expect(copyButton()?.textContent).toBe("Copied ✓");
    copyButton()?.click(); // resets the pending restore timer
    await flushMicrotasks();
    vi.advanceTimersByTime(1500);
    expect(copyButton()?.textContent).toBe("Copy report JSON");
  });

  it("holds the copied label until the flight lands", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    mount({ recorder: stub(() => report({ flights: [flight()] })), initialOpen: true });
    vi.advanceTimersByTime(400);

    // The clipboard resolves on its own schedule, and a navigation can start
    // in that window. Writing the label then would repaint the panel during
    // the very motion it is measuring.
    const screen = mountScreen("PUSHING");
    copyButton()?.click();
    await flushMicrotasks();
    expect(copyButton()?.textContent).toBe("Copy report JSON");

    screen.setAttribute("data-flemo-status", "COMPLETED");
    vi.advanceTimersByTime(400);
    expect(copyButton()?.textContent).toBe("Copied ✓");

    // …and the restore timer waits for the same condition.
    screen.setAttribute("data-flemo-status", "POPPING");
    vi.advanceTimersByTime(2000);
    expect(copyButton()?.textContent).toBe("Copied ✓");
    screen.setAttribute("data-flemo-status", "COMPLETED");
    vi.advanceTimersByTime(400);
    expect(copyButton()?.textContent).toBe("Copy report JSON");
  });

  it("drops the pending label restore when the panel detaches first", async () => {
    setClipboard({ writeText: () => Promise.resolve() });
    mount({ recorder: stub(() => report({ flights: [flight()] })), initialOpen: true });
    vi.advanceTimersByTime(400);
    copyButton()?.click();
    await flushMicrotasks();
    expect(copyButton()?.textContent).toBe("Copied ✓");

    panel?.detach();
    panel = null;
    // The restore timer is still queued; it must find the panel gone and do
    // nothing rather than write into a detached tree.
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });

  it("falls back to execCommand when the clipboard rejects", async () => {
    const execCommand = vi.fn(() => true);
    setClipboard({ writeText: () => Promise.reject(new Error("denied")) });
    setExecCommand(execCommand);
    mount({ recorder: stub(() => report()), initialOpen: true });
    vi.advanceTimersByTime(400);
    copyButton()?.click();
    await flushMicrotasks();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(copyButton()?.textContent).toBe("Copied ✓");
  });

  it("defers the rejected-clipboard fallback until the flight lands", async () => {
    let reject = (_error: Error): void => {};
    const execCommand = vi.fn(() => true);
    setClipboard({
      writeText: () =>
        new Promise<void>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        })
    });
    setExecCommand(execCommand);
    mount({ recorder: stub(() => report()), initialOpen: true });
    vi.advanceTimersByTime(400);

    const screen = mountScreen("PUSHING");
    copyButton()?.click();
    reject(new Error("denied"));
    await flushMicrotasks();
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelectorAll("textarea")).toHaveLength(0);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    vi.advanceTimersByTime(400);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });

  it("does not run the rejected-clipboard fallback after detach", async () => {
    let reject = (_error: Error): void => {};
    const execCommand = vi.fn(() => true);
    setClipboard({
      writeText: () =>
        new Promise<void>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        })
    });
    setExecCommand(execCommand);
    mount({ recorder: stub(() => report()), initialOpen: true });
    copyButton()?.click();
    panel?.detach();
    panel = null;

    reject(new Error("denied"));
    await flushMicrotasks();
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });

  it("falls back when there is no clipboard at all, and survives a denied execCommand", () => {
    setClipboard(undefined);
    setExecCommand(() => {
      throw new Error("denied");
    });
    mount({ recorder: stub(() => report()), initialOpen: true });
    vi.advanceTimersByTime(400);
    expect(() => copyButton()?.click()).not.toThrow();
    expect(copyButton()?.textContent).toBe("Copied ✓");
  });

  it("tolerates an engine without execCommand", () => {
    setClipboard({});
    setExecCommand(undefined);
    mount({ recorder: stub(() => report()), initialOpen: true });
    vi.advanceTimersByTime(400);
    expect(() => copyButton()?.click()).not.toThrow();
  });

  it("does not touch the label when the clipboard settles after detach", async () => {
    let settle = (): void => {};
    setClipboard({
      writeText: () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        })
    });
    mount({ recorder: stub(() => report()), initialOpen: true });
    vi.advanceTimersByTime(400);
    const button = copyButton();
    button?.click();
    panel?.detach();
    settle();
    await flushMicrotasks();
    expect(button?.textContent).toBe("Copy report JSON");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("attachDevtoolsPanel — resize", () => {
  const drag = (clientY: number) => {
    find(".grip").dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientY }));
    window.dispatchEvent(new MouseEvent("pointerup"));
  };

  it("drags the top edge, clamps, and persists the height in sessionStorage", () => {
    mount({ recorder: stub(() => report()), initialOpen: true });
    const height = window.innerHeight;
    drag(height - 300);
    expect(find(".panel").style.height).toBe("300px");
    expect(sessionStorage.getItem("flemo:devtools-panel-height")).toBe("300");

    drag(height - 10); // below the minimum
    expect(find(".panel").style.height).toBe("120px");
    drag(-10_000); // above 90% of the viewport
    expect(find(".panel").style.height).toBe(`${Math.round(height * 0.9)}px`);
  });

  it("restores a persisted height and ignores a malformed one", () => {
    sessionStorage.setItem("flemo:devtools-panel-height", "260");
    mount({ recorder: stub(() => report()) });
    expect(find(".panel").style.height).toBe("260px");
    panel?.detach();
    panel = null;

    sessionStorage.setItem("flemo:devtools-panel-height", "not-a-height");
    mount({ recorder: stub(() => report()) });
    expect(find(".panel").style.height).toBe(`${Math.round(window.innerHeight * 0.4)}px`);
  });

  it("works when storage is denied", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        }
      }
    });
    try {
      mount({ recorder: stub(() => report()), initialOpen: true });
      expect(find(".panel").style.height).toBe(`${Math.round(window.innerHeight * 0.4)}px`);
      find(".grip").dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      expect(() => window.dispatchEvent(new MouseEvent("pointerup"))).not.toThrow();
      panel?.detach();
      panel = null;
    } finally {
      if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    }
  });
});

describe("attachDevtoolsPanel — the motion/images sections", () => {
  const findings = () =>
    flight({
      motion: {
        sampledFrames: 30,
        stalledFrames: 12,
        longestStallMs: 250,
        pausedAfterRelease: true,
        holdReassertedAtMs: 180
      },
      images: {
        loadingAtStart: 12,
        addedDuringFlight: 3,
        completedDuringFlight: 5,
        heldDuringFlight: 5,
        completedUnheld: 1
      },
      landing: {
        residualInlineTransforms: [],
        offViewportAtRest: false,
        stuckStatuses: [],
        orphanedHolds: ["3 × image reveal hold (data-flemo-img-hold) still marked at rest"]
      }
    });

  it("shows the defects a human would otherwise have to read JSON for", () => {
    mount({
      recorder: stub(() => report({ flights: [findings()] })),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);

    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("motion (did it move)");
    expect(detail).toContain("250ms");
    expect(detail).toContain("180ms");
    expect(detail).toContain("still marked at rest");
    expect(detail).toContain("completed mid-flight");
    expect(detail).toContain("added mid-flight3");
    expect(detail).toContain("completed without hold1");
  });

  it("marks a real finding, and leaves a clean flight unmarked", () => {
    mount({
      recorder: stub(() => report({ flights: [findings()] })),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);

    // Every one of the five findings above is toned: a reader must not have
    // to compare numbers to notice that the screen stopped moving.
    const toned = find(".detail").querySelectorAll(".v.bad");
    expect(toned.length).toBeGreaterThanOrEqual(5);
  });

  it("renders a clean motion/images block without a single tone", () => {
    mount({
      recorder: stub(() =>
        report({
          flights: [
            flight({
              motion: {
                sampledFrames: 30,
                stalledFrames: 0,
                longestStallMs: 0,
                pausedAfterRelease: false,
                holdReassertedAtMs: null
              },
              images: {
                loadingAtStart: 12,
                addedDuringFlight: 0,
                completedDuringFlight: 4,
                heldDuringFlight: 12,
                completedUnheld: 0
              },
              landing: {
                residualInlineTransforms: [],
                offViewportAtRest: false,
                stuckStatuses: [],
                orphanedHolds: []
              }
            })
          ]
        })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);

    const detail = find(".detail");
    expect(detail.querySelectorAll(".v.bad")).toHaveLength(0);
    expect(detail.textContent).toContain("orphaned holds");
  });
});

describe("attachDevtoolsPanel — flight detail", () => {
  it("renders every section of a rich flight", () => {
    mount({
      recorder: stub(() =>
        report({
          flights: [
            flight({
              routerId: "root",
              longTasks: [{ startMs: 1200, durationMs: 180 }],
              holdLongTasks: [{ startMs: 900, durationMs: 60 }],
              landing: {
                residualInlineTransforms: ["screen[0] transform=translateX(10px)"],
                offViewportAtRest: true,
                stuckStatuses: ["PUSHING"]
              },
              anomalies: ["landing residue"],
              frameSamples: {
                held: { count: 7, medianGapMs: 18.1, maxGapMs: 45, over30Count: 1 },
                released: { count: 4, medianGapMs: 16.7, maxGapMs: 33, gaps: [16.7, 33, 16.7, 0] }
              }
            })
          ]
        })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("root");
    expect(detail).toContain("2026-08-18T09:00:00.000Z");
    expect(detail).toContain("600ms");
    expect(detail).toContain("park-under");
    expect(detail).toContain("7 frames · median 18.1ms · max 45ms · >30ms ×1");
    // over30Count absent on the released phase: the segment is simply omitted.
    expect(detail).toContain("4 frames · median 16.7ms · max 33ms");
    expect(detail).toContain("1200ms + 180ms");
    expect(detail).toContain("900ms + 60ms (absorbed by hold)");
    expect(detail).toContain("screen[0] transform=translateX(10px)");
    expect(detail).toContain("PUSHING");
    expect(detail).toContain("landing residue");
    expect(shadow().querySelector(".spark")).not.toBeNull();
    expect(shadow().querySelector("polyline")?.getAttribute("points")).toContain(",");
  });

  it("renders a bare flight with dashes instead of crashing", () => {
    mount({
      recorder: stub(() =>
        report({ flights: [{}], environment: undefined, blindSpots: undefined })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    expect(find(".env").textContent).toBe(DASH);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.textContent).toContain(DASH);
    // No id to select by, so the detail pane stays on its empty state.
    expect(find(".detail").textContent).toContain("select a flight");
    expect(find(".foot").textContent).toContain("What this cannot see");
  });

  it("renders a clean flight's empty sections", () => {
    mount({
      recorder: stub(() => report({ flights: [flight({ frameSamples: undefined })] })),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("clean");
    expect(detail).toContain("none");
    expect(shadow().querySelector(".spark")).toBeNull();
    expect(texts(".kv").some((value) => value.includes(DASH))).toBe(true);
  });

  it("renders a flight that carries nothing but an id", () => {
    mount({
      recorder: stub(() => report({ flights: [{ id: "flight-1" }] })),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("flight-1");
    expect(detail).toContain(DASH);
    // Absent long tasks / landing / anomalies read as "none", not as a crash.
    expect(detail).toContain("clean");
    expect(detail).toContain("none");
  });

  it("draws a flat sparkline when every released gap is zero", () => {
    mount({
      recorder: stub(() =>
        report({
          flights: [
            flight({
              frameSamples: {
                held: { count: 0, medianGapMs: 0, maxGapMs: 0, over30Count: 0 },
                released: { count: 2, medianGapMs: 0, maxGapMs: 0, over30Count: 0, gaps: [0, 0] }
              }
            })
          ]
        })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    expect(shadow().querySelector("polyline")?.getAttribute("points")).toBe("0,27 100,27");
  });
});

describe("panel formatting helpers", () => {
  it("renders absent values as a dash", () => {
    expect(formatText(undefined)).toBe(DASH);
    expect(formatText(null)).toBe(DASH);
    expect(formatText("")).toBe(DASH);
    expect(formatText(0)).toBe("0");
    expect(formatMs(600.4)).toBe("600ms");
    expect(formatMs(Number.NaN)).toBe(DASH);
    expect(formatMs(undefined)).toBe(DASH);
    expect(formatGapMs(16.666)).toBe("16.7ms");
    expect(formatGapMs(null)).toBe(DASH);
    expect(formatCount(3)).toBe("3");
    expect(formatCount(undefined)).toBe(DASH);
    expect(formatBool(true)).toBe("yes");
    expect(formatBool(false)).toBe("no");
    expect(formatBool(undefined)).toBe(DASH);
  });

  it("summarizes environments, including partial ones", () => {
    expect(environmentSummary(null)).toBe(DASH);
    expect(environmentSummary(report({ environment: undefined }))).toBe(DASH);
    expect(environmentSummary(report({ environment: {} }))).toBe(
      `${DASH} · dpr ${DASH} · ${DASH} · rAF ${DASH}`
    );
    expect(environmentSummary(report({ environment: { viewport: { width: 100 } } }))).toContain(
      DASH
    );
  });

  it("keys the flight list on the values it shows", () => {
    expect(flightListSignature([flight()], "flight-1")).toBe(
      "flight-1#flight-1|PUSH|compiled|600|2|0"
    );
    expect(flightListSignature([{} as FlightRecord], null)).toBe("#|||0|0|0");
  });

  it("only reports a released-gap series it can actually see", () => {
    expect(releasedGapSeries(undefined)).toBeNull();
    expect(releasedGapSeries(flight().frameSamples)).toBeNull();
    const withGaps = (gaps: unknown) =>
      releasedGapSeries({ released: { gaps } } as unknown as FlightRecord["frameSamples"]);
    expect(withGaps([1])).toBeNull();
    expect(withGaps(["a", Number.NaN, 1])).toBeNull();
    expect(withGaps([16.7, "a", 33])).toEqual([16.7, 33]);
  });
});

describe("panel DOM helpers", () => {
  it("builds, clears and updates nodes without innerHTML", () => {
    const node = el("div");
    expect(node.className).toBe("");
    expect(node.textContent).toBe("");
    const labelled = el("span", "k", "<script>");
    expect(labelled.className).toBe("k");
    expect(labelled.textContent).toBe("<script>");
    expect(labelled.querySelector("script")).toBeNull();

    node.appendChild(labelled);
    clear(node);
    expect(node.childNodes).toHaveLength(0);

    setText(node, "a");
    setText(node, "a");
    expect(node.textContent).toBe("a");

    const svg = svgEl("svg", { viewBox: "0 0 1 1" });
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1 1");
  });
});

// THE SECTIONS THAT ANSWER "did the shared elements fly", "what did the
// browser report in a single frame", and "what actually drove this".
describe("attachDevtoolsPanel — shared elements, tripwires and input", () => {
  const rich = () =>
    report({
      verdict: ["NOT EVIDENCE: 1 judging precondition(s) failed — build-mode."],
      preconditions: [
        { id: "build-mode", status: "violated", detail: "development-server globals are present" },
        { id: "display-cadence", status: "ok", detail: "60Hz" }
      ],
      flights: [
        flight({
          motion: {
            sampledFrames: 20,
            stalledFrames: 0,
            longestStallMs: 0,
            pausedAfterRelease: false,
            holdReassertedAtMs: null,
            tailFrames: 3,
            firstAnimationAtMs: 22
          },
          morphs: {
            registered: 4,
            pairable: ["hero", "title"],
            flew: ["hero"],
            skipped: ["title"],
            camera: true,
            ghosts: 1,
            strandedRoles: 1,
            strandedStandIns: 0,
            strandedGhosts: 0,
            leakedSheetRules: 2,
            layerResidue: 3,
            duplicatedKeys: ["card"]
          },
          tripwires: [
            { kind: "animation-cancel", atMs: 41.2, detail: "flemo-screen-x was CANCELLED" }
          ],
          input: { trusted: 0, synthetic: 2, pointerTypes: ["mouse"] }
        })
      ]
    });

  it("leads the header with the verdict and the failed preconditions", () => {
    mount({ recorder: stub(rich), initialOpen: true });
    vi.advanceTimersByTime(400);
    const chips = texts(".chip");
    expect(chips[0]).toContain("NOT EVIDENCE");
    expect(chips.some((chip) => chip.startsWith("build-mode:"))).toBe(true);
    // An `ok` precondition is not a chip: the header is for what is wrong.
    expect(chips.some((chip) => chip.startsWith("display-cadence"))).toBe(false);
  });

  it("names the shared elements that did not fly, and the residue they left", () => {
    mount({ recorder: stub(rich), initialOpen: true });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("shared elements");
    expect(detail).toContain("did not fly");
    expect(detail).toContain("title");
    expect(detail).toContain("duplicate keys in one screen");
    expect(detail).toContain("1 roles");
    expect(detail).toContain("3 in layer");
    expect(detail).toContain("2 rules");
  });

  it("renders a tripwire with the offset the browser reported it at", () => {
    mount({ recorder: stub(rich), initialOpen: true });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("tripwires (one-frame events)");
    expect(detail).toContain("+41ms animation-cancel");
  });

  it("shows what drove the navigation, and marks a synthetic one", () => {
    mount({ recorder: stub(rich), initialOpen: true });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("what drove it");
    expect(detail).toContain("2 synthetic");
    expect(detail).toContain("mouse");
    expect(find(".detail").querySelectorAll(".v.bad").length).toBeGreaterThan(0);
  });

  it("reports when the first keyframe started, and says so when none did", () => {
    mount({ recorder: stub(rich), initialOpen: true });
    vi.advanceTimersByTime(400);
    expect(find(".detail").textContent).toContain("+22ms after t0");
  });

  it("says nothing about shared elements on a flight that had none", () => {
    mount({ recorder: stub(() => report({ flights: [flight()] })), initialOpen: true });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("not observed");
    expect(detail).not.toContain("tripwires (one-frame events)");
  });

  it("arms a comparison bucket from the header and cycles it back off", () => {
    const marks: (string | null)[] = [];
    mount({
      recorder: {
        ...stub(() => report()),
        mark: (bucket: string | null) => {
          marks.push(bucket);
          return bucket;
        }
      } as never,
      initialOpen: true,
      buckets: ["A", "B"]
    });
    vi.advanceTimersByTime(400);
    const button = () => actButton("A/B: off") ?? actButton("A/B: A") ?? actButton("A/B: B")!;
    button().click();
    expect(button().textContent).toBe("A/B: A");
    button().click();
    button().click();
    expect(marks).toEqual(["A", "B", null]);
  });

  it("renders the new sections of a bare flight with dashes instead of crashing", () => {
    mount({
      recorder: stub(() =>
        report({
          verdict: undefined,
          preconditions: undefined,
          flights: [{ id: "flight-1", morphs: {}, tripwires: [], input: {} }]
        })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("shared elements");
    expect(detail).toContain("what drove it");
    expect(detail).toContain("none observed");
    expect(detail).toContain("clean");
    expect(detail).not.toContain("tripwires (one-frame events)");
  });

  it("renders a flight whose shared elements are all present and clean", () => {
    mount({
      recorder: stub(() =>
        report({
          flights: [
            flight({
              morphs: {
                registered: 2,
                pairable: ["hero"],
                flew: ["hero"],
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
              input: { trusted: 2, synthetic: 0, pointerTypes: ["touch"] }
            })
          ]
        })
      ),
      initialOpen: true
    });
    vi.advanceTimersByTime(400);
    const detail = find(".detail").textContent ?? "";
    expect(detail).toContain("did not flynone");
    expect(detail).toContain("residue at restclean");
    expect(detail).toContain("touch");
    expect(find(".detail").querySelectorAll(".v.bad")).toHaveLength(0);
  });
});
