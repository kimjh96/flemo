import { afterEach, describe, expect, it, vi } from "vitest";

import { attachFlightRecorder } from "../recorder";

import type { FlightRecorderHandle } from "../types";

// Branch coverage for the recorder's guarded/optional paths: SSR, the
// longtask observer, participant counting, compiled/mixed classification,
// the stuck watchdog, the off-viewport landing parse, logging, provisional
// flights, and global-slot edge cases.

const frame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const frames = async (count: number) => {
  for (let index = 0; index < count; index += 1) await frame();
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let handle: FlightRecorderHandle | null = null;

const attach = (options?: Parameters<typeof attachFlightRecorder>[0]) => {
  handle = attachFlightRecorder(options);
  return handle;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
  sessionStorage.clear();
  localStorage.clear();
  delete (window as unknown as { flemo?: unknown }).flemo;
  delete (window as unknown as { __flemoPlayerGaps?: number[] }).__flemoPlayerGaps;
});

const mountScreen = () => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", "IDLE");
  screen.setAttribute("data-flemo-active", "false");
  document.body.appendChild(screen);
  return screen;
};

const runFlight = async (screen: HTMLElement, status = "PUSHING") => {
  screen.setAttribute("data-flemo-status", status);
  screen.setAttribute("data-flemo-active", "true");
  await settle();
  await frames(2);
  screen.setAttribute("data-flemo-status", "COMPLETED");
  await settle();
  await frames(4);
};

describe("attachFlightRecorder branches", () => {
  it("returns an inert handle without a DOM (SSR)", () => {
    vi.stubGlobal("window", undefined);
    const recorder = attachFlightRecorder();
    const report = recorder.report();
    expect(report.flights).toEqual([]);
    expect(report.overrides.warnings.some((entry) => entry.includes("no DOM available"))).toBe(
      true
    );
    expect(() => recorder.detach()).not.toThrow();
    vi.unstubAllGlobals();
    // The inert handle is not registered: a real attach still works after.
    const real = attach();
    expect(real).not.toBe(recorder);
  });

  it("collects long tasks via PerformanceObserver and correlates them to the flight", async () => {
    let observerCallback: ((list: { getEntries: () => unknown[] }) => void) | null = null;
    class FakePerformanceObserver {
      static supportedEntryTypes = ["longtask"];
      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("PerformanceObserver", FakePerformanceObserver);

    const screen = mountScreen();
    attach();
    await settle();
    expect(observerCallback).not.toBeNull();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    // A long task landing right on the opening window.
    observerCallback!({
      getEntries: () => [{ startTime: performance.now() - 10, duration: 180 }]
    });
    await frames(2);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3);

    const flight = handle!.report().flights[0];
    expect(flight.longTasks.length).toBeGreaterThanOrEqual(1);
    expect(flight.anomalies.some((entry) => entry.includes("opening-swallow risk"))).toBe(true);
  });

  it("files a long task inside the hold as absorbed, not opening-swallow", async () => {
    let observerCallback: ((list: { getEntries: () => unknown[] }) => void) | null = null;
    class FakePerformanceObserver {
      static supportedEntryTypes = ["longtask"];
      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("PerformanceObserver", FakePerformanceObserver);

    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    screen.setAttribute("data-flemo-anim-hold", "park-under");
    await settle();
    // A heavy commit fully inside the hold window (ending before the
    // release) — the absorption the hold exists for. Backdated so its END
    // predates the upcoming release regardless of jsdom frame timing.
    observerCallback!({
      getEntries: () => [{ startTime: performance.now() - 200, duration: 150 }]
    });
    await frames(3);
    screen.setAttribute("data-flemo-anim-hold", "false");
    await settle();
    await frames(2);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3);

    const flight = handle!.report().flights[0];
    expect(flight.holdLongTasks.length).toBeGreaterThanOrEqual(1);
    expect(flight.longTasks).toEqual([]);
    expect(flight.anomalies.some((entry) => entry.includes("absorbed by the hold"))).toBe(true);
    expect(flight.anomalies.some((entry) => entry.includes("opening-swallow"))).toBe(false);
  });

  it("counts bar, decorator, and part participants", async () => {
    const screen = mountScreen();
    const bar = document.createElement("div");
    bar.setAttribute("data-flemo-bar", "");
    bar.setAttribute("data-flemo-bar-riding", "true");
    const decorator = document.createElement("div");
    decorator.setAttribute("data-flemo-decorator", "");
    decorator.setAttribute("data-flemo-status", "PUSHING");
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", "dock");
    part.setAttribute("data-flemo-status", "PUSHING");
    document.body.append(bar, decorator, part);

    attach();
    await settle();
    await runFlight(screen);

    const flight = handle!.report().flights[0];
    expect(flight.participants).toEqual({ screens: 1, bars: 1, decorators: 1, parts: 1 });
  });

  it("classifies a running flemo-* CSSAnimation as compiled, and mixed with a player stake", async () => {
    const screen = mountScreen();
    (screen as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [
      { animationName: "flemo-screen-cupertino-enter", playState: "running" }
    ];
    attach();
    await settle();
    await runFlight(screen);
    expect(handle!.report().flights[0].driver).toBe("compiled");

    // Same signature plus an inline player stake → mixed.
    screen.style.animation = "none";
    await runFlight(screen, "POPPING");
    const flights = handle!.report().flights;
    expect(flights[1].driver).toBe("mixed");
  });

  it("finalizes a >10s transitional flight as stuck via the rAF watchdog", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(1);

    const realNow = performance.now.bind(performance);
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => realNow() + 11_000);
    await frames(2);
    nowSpy.mockRestore();

    const report = handle!.report();
    const flight = report.flights[0];
    expect(flight.landing.stuckStatuses).toEqual(["PUSHING"]);
    expect(flight.anomalies.some((entry) => entry.includes("stuck >10s"))).toBe(true);

    // Recovery: the queue unlocks and a fresh flight records normally.
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await runFlight(screen, "POPPING");
    expect(handle!.report().flights).toHaveLength(2);
  });

  it("reports a still-open flight provisionally, and a stuck one at report time", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(1);

    const openReport = handle!.report();
    expect(openReport.flights).toHaveLength(1);
    expect(openReport.flights[0].id).toContain("(in flight)");

    // The same open flight judged >10s old at report(): stuck at session level
    // (rAF is throttled here so the watchdog never ran).
    const realNow = performance.now.bind(performance);
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => realNow() + 11_000);
    const stuckReport = handle!.report();
    nowSpy.mockRestore();
    expect(stuckReport.anomalies.some((entry) => entry.includes("still transitional"))).toBe(true);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
  });

  it("unions a screen that joins mid-flight into the participants", async () => {
    const first = mountScreen();
    attach();
    await settle();

    first.setAttribute("data-flemo-status", "PUSHING");
    first.setAttribute("data-flemo-active", "true");
    await settle();
    const second = mountScreen();
    second.setAttribute("data-flemo-status", "PUSHING");
    await settle();
    await frames(1);
    first.setAttribute("data-flemo-status", "COMPLETED");
    second.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3);

    expect(handle!.report().flights[0].participants.screens).toBe(2);
  });

  it("flags an off-viewport COMPLETED+active landing (blank-viewport signature)", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    screen.style.opacity = "0.5"; // opacity residue path too
    await settle();
    await frames(1);

    // jsdom's getComputedStyle has no layout: substitute a resting matrix a
    // whole viewport off screen (what PR #259's bug produced).
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      transform: "matrix(1, 0, 0, 1, -1300, 0)",
      display: "block"
    } as CSSStyleDeclaration);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const report = handle!.report();
    const flight = report.flights[0];
    expect(flight.landing.offViewportAtRest).toBe(true);
    expect(
      flight.landing.residualInlineTransforms.some((entry) => entry.includes("opacity=0.5"))
    ).toBe(true);
    expect(flight.anomalies.some((entry) => entry.includes("blank-viewport signature"))).toBe(true);
    expect(report.anomalies.some((entry) => entry.includes("blank-viewport"))).toBe(true);
  });

  it("logs a one-line summary per flight when log is enabled", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const screen = mountScreen();
    attach({ log: true });
    await settle();
    await runFlight(screen);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("flight-1 PUSH"));
  });

  it("replaces a stale global left by a previous recorder instance", () => {
    (window as unknown as { flemo: unknown }).flemo = {
      __flemoDevtools: true,
      stale: true
    };
    attach();
    const globalApi = (window as unknown as { flemo: { stale?: boolean } }).flemo;
    expect(globalApi.stale).toBeUndefined();
  });

  it("defers observer wiring to DOMContentLoaded when attached before the root exists", async () => {
    // Simulate a document-start attach (Playwright addInitScript): no
    // documentElement yet, so MutationObserver.observe would throw.
    const root = document.documentElement;
    root.remove();
    expect(document.documentElement).toBeNull();

    let recorder: FlightRecorderHandle | null = null;
    expect(() => {
      recorder = attach();
    }).not.toThrow();
    // The handle is valid immediately, before any DOM exists.
    expect(recorder!.report().flights).toEqual([]);

    // The document finishes parsing: root returns, DOMContentLoaded fires.
    document.appendChild(root);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settle();

    // Observation is live from here: a flight records normally.
    const screen = mountScreen();
    await settle();
    await runFlight(screen);
    expect(handle!.report().flights).toHaveLength(1);
  });

  it("cancels pending deferred wiring on detach", async () => {
    const root = document.documentElement;
    root.remove();
    const recorder = attach();
    recorder.detach();
    handle = null;

    document.appendChild(root);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settle();

    // The detached recorder never wired: a status flip is not observed by it,
    // and a fresh recorder attaches cleanly and owns the flight.
    const fresh = attach();
    await settle();
    const screen = mountScreen();
    await settle();
    await runFlight(screen);
    expect(fresh.report().flights).toHaveLength(1);
    expect(recorder.report().flights).toEqual([]);
  });

  it("cancels the sampler when detached mid-flight", async () => {
    const screen = mountScreen();
    const recorder = attach();
    await settle();
    screen.setAttribute("data-flemo-status", "PUSHING");
    await settle();
    await frames(1);
    expect(() => recorder.detach()).not.toThrow();
    // Idempotent second detach.
    expect(() => recorder.detach()).not.toThrow();
  });
});
