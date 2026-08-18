import { afterEach, describe, expect, it, vi } from "vitest";

import { attachFlightRecorder } from "../recorder";

import type { FlightRecorderHandle } from "../types";

// Coverage for the recorder's DEFENSIVE paths — the guards that only fire on
// a hostile or racing embedding: absent attributes, a throwing/blocked
// storage, an observer that cannot be wired or disconnected, a screen that
// leaves the document before the landing audit, a detach landing between two
// steps of a finalization, and the bounded long-task buffer overflowing.
// Every one of them is reached by stubbing a global or a DOM read, never by
// reaching into recorder internals.

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

const mountScreen = (attributes: Record<string, string> = {}) => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", "IDLE");
  screen.setAttribute("data-flemo-active", "false");
  for (const [name, value] of Object.entries(attributes)) screen.setAttribute(name, value);
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

class NoopPerformanceObserver {
  static supportedEntryTypes = ["longtask"];
  constructor(_callback: unknown) {}
  observe() {}
  disconnect() {}
}

describe("recorder — attribute reads that can come back empty", () => {
  it("ignores screens, decorators and parts that carry no status attribute", async () => {
    const screen = mountScreen();
    // Attribute-less siblings: matched by the selectors, but with no
    // data-flemo-status at all. They must read as "not transitional"
    // instead of throwing or counting as participants.
    const bareScreen = document.createElement("div");
    bareScreen.setAttribute("data-flemo-screen", "");
    const bareDecorator = document.createElement("div");
    bareDecorator.setAttribute("data-flemo-decorator", "");
    const barePart = document.createElement("div");
    barePart.setAttribute("data-flemo-part-name", "dock");
    document.body.append(bareScreen, bareDecorator, barePart);

    attach();
    await settle();
    await runFlight(screen);

    expect(handle!.report().flights[0].participants).toEqual({
      screens: 1,
      bars: 0,
      decorators: 0,
      parts: 0
    });
  });

  it("falls back to PUSH when the opening status disappears mid-scan", async () => {
    // The engine clears data-flemo-status the instant a queued navigation is
    // superseded. A screen can therefore pass the transitional scan and read
    // back null one statement later; the flight must still open, as PUSH.
    const screen = mountScreen();
    const realGetAttribute = screen.getAttribute.bind(screen);
    let scanned = false;
    screen.getAttribute = (name: string) => {
      // beginFlight reads data-flemo-active first — use it as the marker
      // that the scan is over and the status has just been dropped.
      if (name === "data-flemo-active") {
        scanned = true;
        return "true";
      }
      if (name === "data-flemo-status" && scanned) {
        scanned = false;
        return null;
      }
      return realGetAttribute(name);
    };

    attach();
    await settle();
    await runFlight(screen);

    const flight = handle!.report().flights[0];
    expect(flight.kind).toBe("PUSH");
  });

  it("tolerates a stuck participant whose status attribute was removed", async () => {
    const held = mountScreen();
    const dropped = mountScreen();
    attach();
    await settle();

    held.setAttribute("data-flemo-status", "PUSHING");
    held.setAttribute("data-flemo-active", "true");
    dropped.setAttribute("data-flemo-status", "PUSHING");
    await settle();
    await frames(1);
    // One participant loses its status entirely while the queue stays locked
    // on the other: the stuck report must list only the real status.
    dropped.removeAttribute("data-flemo-status");
    await settle();
    await frames(1);

    const realNow = performance.now.bind(performance);
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => realNow() + 11_000);
    await frames(2);
    nowSpy.mockRestore();

    expect(handle!.report().flights[0].landing.stuckStatuses).toEqual(["PUSHING"]);
  });

  it("ignores a running animation that is not one of flemo's own", async () => {
    const screen = mountScreen();
    (screen as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [
      { animationName: "app-spinner", playState: "running" },
      { animationName: "flemo-screen-cupertino-enter", playState: "paused" },
      {}
    ];
    attach();
    await settle();
    await runFlight(screen);
    expect(handle!.report().flights[0].driver).toBe("unknown");
  });
});

describe("recorder — hold tracking edges", () => {
  it("adopts a hold that appears after the flight opened, and its removal as the release", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(1);

    // The hold is armed a beat AFTER the status flip (the entering screen
    // mounts late) — the flight must adopt its kind retroactively.
    screen.setAttribute("data-flemo-anim-hold", "park-over");
    await settle();
    await frames(1);

    // Release by REMOVING the attribute rather than writing "false".
    screen.removeAttribute("data-flemo-anim-hold");
    await settle();
    await frames(1);

    // A trailing "false" write with no hold in its history must not move the
    // recorded release point.
    screen.setAttribute("data-flemo-anim-hold", "false");
    await settle();
    await frames(1);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const flight = handle!.report().flights[0];
    expect(flight.holds.kind).toBe("park-over");
    expect(flight.holds.releasedAtMs).not.toBeNull();
  });

  it("treats a hold that never releases as making the whole flight the held phase", async () => {
    let observerCallback: ((list: { getEntries: () => unknown[] }) => void) | null = null;
    class CapturingPerformanceObserver {
      static supportedEntryTypes = ["longtask"];
      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("PerformanceObserver", CapturingPerformanceObserver);

    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    screen.setAttribute("data-flemo-anim-hold", "park-under");
    await settle();
    observerCallback!({
      getEntries: () => [{ startTime: performance.now() - 60, duration: 50 }]
    });
    await frames(2);
    // COMPLETED with the hold STILL armed: releasedAtMs stays null, so the
    // release boundary is the flight's end and every task counts as held.
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const flight = handle!.report().flights[0];
    expect(flight.holds.kind).toBe("park-under");
    expect(flight.holds.releasedAtMs).toBeNull();
    expect(flight.longTasks).toEqual([]);
    expect(flight.holdLongTasks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("recorder — long-task observer limits", () => {
  it("leaves the observer inert when observe() throws", async () => {
    class ThrowingPerformanceObserver {
      static supportedEntryTypes = ["longtask"];
      constructor(_callback: unknown) {}
      observe() {
        throw new Error("longtask entry type blocked");
      }
      disconnect() {
        throw new Error("never reached — the observer was discarded");
      }
    }
    vi.stubGlobal("PerformanceObserver", ThrowingPerformanceObserver);

    const screen = mountScreen();
    const recorder = attach();
    await settle();
    await runFlight(screen);

    expect(recorder.report().flights[0].longTasks).toEqual([]);
    // detach() must not reach the discarded observer's throwing disconnect.
    expect(() => recorder.detach()).not.toThrow();
    handle = null;
  });

  it("caps the long-task buffer, evicting the oldest entries", async () => {
    let observerCallback: ((list: { getEntries: () => unknown[] }) => void) | null = null;
    class CapturingPerformanceObserver {
      static supportedEntryTypes = ["longtask"];
      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("PerformanceObserver", CapturingPerformanceObserver);

    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();

    // 1001 entries in one delivery: the buffer keeps the newest 1000, and the
    // uniquely-marked oldest one is evicted.
    const base = performance.now();
    const entries = Array.from({ length: 1001 }, (_, index) => ({
      startTime: base,
      duration: index === 0 ? 999 : 0.1
    }));
    observerCallback!({ getEntries: () => entries });

    await frames(2);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const flight = handle!.report().flights[0];
    expect(flight.longTasks).toHaveLength(1000);
    expect(flight.longTasks.some((task) => task.durationMs === 999)).toBe(false);
  });
});

describe("recorder — landing audit on a hostile document", () => {
  it("skips a screen that left the document before the audit frames elapsed", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    screen.style.transform = "translateX(40px)";
    await settle();
    await frames(1);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    // Unmounted between finalization and the +2rAF audit: nothing to audit,
    // and no residue may be attributed to a screen that no longer exists.
    screen.remove();
    await frames(4);

    expect(handle!.report().flights[0].landing.residualInlineTransforms).toEqual([]);
  });

  it("skips a frozen (display:none) screen and survives a styleless computed style", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    screen.style.transform = "translateX(40px)";
    await settle();
    await frames(1);

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "none"
    } as CSSStyleDeclaration);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    // The engine's covered-screen freeze owns this screen's styles — its
    // inline transform is not a landing residue.
    expect(handle!.report().flights[0].landing.residualInlineTransforms).toEqual([]);
  });

  it("audits with a computed style that exposes neither transform nor display", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    screen.style.transform = "translateX(40px)";
    await settle();
    await frames(1);

    vi.spyOn(window, "getComputedStyle").mockReturnValue({} as CSSStyleDeclaration);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const landing = handle!.report().flights[0].landing;
    expect(landing.residualInlineTransforms.some((entry) => entry.includes("translateX"))).toBe(
      true
    );
    // No parseable transform and no viewport basis: no off-viewport claim.
    expect(landing.offViewportAtRest).toBe(false);
  });

  it("makes no off-viewport claim when the viewport width is unreadable", async () => {
    // Neither visualViewport nor innerWidth: the audit has no basis for the
    // blank-viewport comparison and must stay silent rather than guess.
    vi.stubGlobal("innerWidth", undefined);
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(1);

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      transform: "matrix(1, 0, 0, 1, -1300, 0)",
      display: "block"
    } as CSSStyleDeclaration);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    expect(handle!.report().flights[0].landing.offViewportAtRest).toBe(false);
  });

  it("measures the viewport from visualViewport when the page is zoomed", async () => {
    (window as unknown as { visualViewport?: { width: number } }).visualViewport = { width: 400 };
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(1);

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      transform: "matrix(1, 0, 0, 1, -300, 0)",
      display: "block"
    } as CSSStyleDeclaration);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    expect(handle!.report().flights[0].landing.offViewportAtRest).toBe(true);
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  });
});

describe("recorder — races around finalization and detach", () => {
  it("survives a sampler frame that outlives its flight", async () => {
    // requestAnimationFrame that still schedules but hands back no id: the
    // finalizer has nothing to cancel, so the pending sampler frame fires
    // after the flight closed and must return without recording anything.
    const realRaf = globalThis.requestAnimationFrame.bind(globalThis);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      realRaf(callback);
      return null as unknown as number;
    });

    const screen = mountScreen();
    attach();
    await settle();
    await runFlight(screen);
    await frames(2);

    const flights = handle!.report().flights;
    expect(flights).toHaveLength(1);
    expect(flights[0].id).toBe("flight-1");
  });

  it("records nothing when a detach lands inside the finalizing call", async () => {
    const screen = mountScreen();
    const recorder = attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(1);

    // Detach exactly while the finalizer's end timestamp is being taken —
    // the closing flight is already gone by the time the record is built.
    const realNow = performance.now.bind(performance);
    let armed = true;
    vi.spyOn(performance, "now").mockImplementation(() => {
      if (armed) {
        armed = false;
        recorder.detach();
      }
      return realNow();
    });

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    vi.restoreAllMocks();
    handle = null;

    expect(armed).toBe(false);
    expect(recorder.report().flights).toEqual([]);
  });

  it("ignores mutations delivered after detach when the observer refuses to disconnect", async () => {
    vi.spyOn(MutationObserver.prototype, "disconnect").mockImplementation(() => {});
    const screen = mountScreen();
    const recorder = attach();
    await settle();
    recorder.detach();
    handle = null;

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(2);

    expect(recorder.report().flights).toEqual([]);
  });

  it("leaves a foreign window.flemo installed after this recorder attached alone", () => {
    const recorder = attach();
    const foreign = { name: "someone else's devtools" };
    (window as unknown as { flemo: unknown }).flemo = foreign;
    recorder.detach();
    handle = null;
    expect((window as unknown as { flemo: unknown }).flemo).toBe(foreign);
  });
});

describe("recorder — observer wiring failures", () => {
  it("retries on DOMContentLoaded when observe() throws at attach time", async () => {
    const observeSpy = vi.spyOn(MutationObserver.prototype, "observe").mockImplementation(() => {
      throw new Error("root replaced mid-wire");
    });

    const recorder = attach();
    expect(recorder.report().flights).toEqual([]);

    // The root settles and DOMContentLoaded fires: wiring succeeds now.
    observeSpy.mockRestore();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settle();

    const screen = mountScreen();
    await settle();
    await runFlight(screen);
    expect(recorder.report().flights).toHaveLength(1);
  });

  it("does not wire when the deferred DOMContentLoaded callback races a detach", async () => {
    const root = document.documentElement;
    root.remove();

    let domReady: (() => void) | null = null;
    const realAdd = document.addEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject, options?: unknown) => {
        if (type === "DOMContentLoaded") {
          domReady = listener as () => void;
          return;
        }
        realAdd(type, listener, options as boolean | AddEventListenerOptions | undefined);
      }
    );

    const recorder = attach();
    document.appendChild(root);
    recorder.detach();
    handle = null;

    // The event was already dispatching when detach ran: the callback still
    // arrives, and must not wire an observer onto a dead recorder.
    expect(domReady).not.toBeNull();
    domReady!();
    vi.restoreAllMocks();

    const screen = mountScreen();
    await settle();
    await runFlight(screen);
    expect(recorder.report().flights).toEqual([]);
  });
});

describe("recorder — report-time storage failures", () => {
  it("reports a null driver policy when direct storage reads throw", async () => {
    vi.stubGlobal("PerformanceObserver", NoopPerformanceObserver);
    const recorder = attach();
    await settle();

    const blocked = new Proxy(
      {},
      {
        get() {
          throw new Error("storage partitioned");
        }
      }
    );
    vi.stubGlobal("sessionStorage", blocked);
    vi.stubGlobal("localStorage", blocked);

    const report = recorder.report();
    vi.unstubAllGlobals();

    expect(report.driverPolicy).toEqual({ demotion: null, forcePin: null });
    expect(report.overrides.active).toEqual({});
  });

  it("carries the router id onto a still-open provisional flight", async () => {
    const screen = mountScreen({ "data-flemo-router": "root" });
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "POPPING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(1);

    const open = handle!.report().flights[0];
    expect(open.id).toContain("(in flight)");
    expect(open.routerId).toBe("root");

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);
  });
});
