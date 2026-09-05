import { afterEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import {
  beginFlightWindow,
  flightWindowActive,
  onFlightWindowIdle,
  resetFlightWindowForTests
} from "@core/engine/flightWindow";
import { learnedFrameIntervalMs, reportDisplayIntervalMs } from "@platform/displayCadence";

// The global flight-window latch (flightWindow.ts): insertion-time machinery
// outside the engine's drive learns a navigation is mid-flight and defers
// visible reveals to its rest.

describe("flightWindow", () => {
  afterEach(resetFlightWindowForTests);

  it("runs an idle callback immediately when no window is open", () => {
    const callback = vi.fn();
    onFlightWindowIdle(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("defers idle callbacks until every nested window releases", () => {
    const callback = vi.fn();
    const releaseOuter = beginFlightWindow();
    const releaseInner = beginFlightWindow();
    onFlightWindowIdle(callback);
    expect(flightWindowActive()).toBe(true);

    releaseInner();
    expect(callback).not.toHaveBeenCalled();
    releaseOuter();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(flightWindowActive()).toBe(false);
  });

  it("a double release is a no-op (the composed release can run once per path)", () => {
    const release = beginFlightWindow();
    release();
    release();
    expect(flightWindowActive()).toBe(false);
    const callback = vi.fn();
    onFlightWindowIdle(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe("engine wiring", () => {
  afterEach(resetFlightWindowForTests);

  it("a transitional drive opens the flight window and its landing closes it", () => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    const engine = createTransitionEngine({
      getTransitionTaskId: vi.fn(() => null),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    });
    expect(transitionMap.get("cupertino")).toBeTruthy();
    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "REPLACING",
      isActive: true,
      animHoldReleased: true
    });
    expect(flightWindowActive()).toBe(true);
    cleanup();
    // The hold outlives the drive; an interrupting transition with a flipped
    // role consumes the composed release before its own first frame.
    const cleanupInterrupt = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "POPPING",
      isActive: true,
      animHoldReleased: true
    });
    expect(flightWindowActive()).toBe(false);
    cleanupInterrupt();
    scope.remove();
  });
});

// The learned display cadence (displayCadence.ts): high-refresh
// Blink (measured 36% partial presents on the 120Hz player) and desktop
// WebKit (rAF capped at 60Hz against the panel's 120) both route to the
// compositor-driven compiled tier; phones and 60Hz displays keep the
// device-verified player.
describe("compiled-tier routing", () => {
  const asBlink = <T>(run: () => T): T => {
    const nav = navigator as { userAgentData?: unknown };
    nav.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    try {
      return run();
    } finally {
      delete nav.userAgentData;
    }
  };

  afterEach(() => {
    reportDisplayIntervalMs(1000 / 60); // restore the 60Hz-nominal seed
  });

  it("a sub-12ms learned interval keeps the screen on the compiled path (Blink)", () => {
    reportDisplayIntervalMs(8.3);
    expect(learnedFrameIntervalMs()).toBeLessThan(12);
    asBlink(() => {
      const scope = document.createElement("div");
      document.body.appendChild(scope);
      const engine = createTransitionEngine({
        getTransitionTaskId: vi.fn(() => "task-hr"),
        setDragStatus: vi.fn(),
        setReplaceTransitionStatus: vi.fn()
      });
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      expect(scope.style.animation).toBe("");
      cleanup();
      scope.remove();
    });
  });

  it("the compiled tier reshapes the scope easing with the landing governor", () => {
    reportDisplayIntervalMs(8.3);
    asBlink(() => {
      const scope = document.createElement("div");
      Object.defineProperty(scope, "clientWidth", { value: 1200, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
      document.body.appendChild(scope);
      const engine = createTransitionEngine({
        getTransitionTaskId: vi.fn(() => "task-govern"),
        setDragStatus: vi.fn(),
        setReplaceTransitionStatus: vi.fn()
      });
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      // SETTLED 2026-08-18: the desktop landing governor is GONE — its
      // one-device-px staircase was live-judged as the pop "드르륵" and its
      // removal fixed it. Desktop compiled flights play the authored curve
      // untouched; the governor remains a touch-tier mechanism only.
      expect(scope.style.animationTimingFunction).toBe("");
      cleanup();
      scope.remove();
    });
  });

  it("desktop Blink routes compiled even at a 60Hz-measured cadence (adaptive panel trap)", () => {
    reportDisplayIntervalMs(1000 / 60);
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    asBlink(() => {
      const scope = document.createElement("div");
      Object.defineProperty(scope, "clientWidth", { value: 1200, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
      document.body.appendChild(scope);
      const engine = createTransitionEngine({
        getTransitionTaskId: vi.fn(() => "task-desktop-blink"),
        setDragStatus: vi.fn(),
        setReplaceTransitionStatus: vi.fn()
      });
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      expect(scope.style.animation).toBe(""); // compiled path: no player suppression
      // SETTLED 2026-08-18: the desktop landing governor is GONE — its
      // one-device-px staircase was live-judged as the pop "드르륵" and its
      // removal fixed it. Desktop compiled flights play the authored curve
      // untouched; the governor remains a touch-tier mechanism only.
      expect(scope.style.animationTimingFunction).toBe("");
      cleanup();
      scope.remove();
    });
    Reflect.deleteProperty(navigator, "maxTouchPoints");
  });

  it("desktop WebKit (Mac platform, no touch) declines the player for the compiled tier", () => {
    const platform = Object.getOwnPropertyDescriptor(Navigator.prototype, "platform");
    Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    try {
      const scope = document.createElement("div");
      document.body.appendChild(scope);
      const engine = createTransitionEngine({
        getTransitionTaskId: vi.fn(() => "task-mac"),
        setDragStatus: vi.fn(),
        setReplaceTransitionStatus: vi.fn()
      });
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      expect(scope.style.animation).toBe(""); // compiled path: no suppression
      cleanup();
      scope.remove();
    } finally {
      Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
      if (platform) Object.defineProperty(Navigator.prototype, "platform", platform);
      else Reflect.deleteProperty(navigator, "platform");
    }
  });

  it("a touch WebKit device (a real phone) routes to the compiled tier — singles included", () => {
    Object.defineProperty(navigator, "platform", { value: "iPhone", configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    try {
      const scope = document.createElement("div");
      Object.defineProperty(scope, "clientWidth", { value: 393, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 760, configurable: true });
      document.body.appendChild(scope);
      const engine = createTransitionEngine({
        getTransitionTaskId: vi.fn(() => "task-touch"),
        setDragStatus: vi.fn(),
        setReplaceTransitionStatus: vi.fn()
      });
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      expect(scope.style.animation).toBe(""); // governed-compiled: the player does NOT drive (no inline pin)
      cleanup();
      scope.remove();
    } finally {
      Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
      Reflect.deleteProperty(navigator, "platform");
    }
  });

  it("a touch WebKit REPLACING navigation (tab switch) routes to the compiled tier", () => {
    Object.defineProperty(navigator, "platform", { value: "iPhone", configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    try {
      const scope = document.createElement("div");
      document.body.appendChild(scope);
      const engine = createTransitionEngine({
        getTransitionTaskId: vi.fn(() => "task-replace"),
        setDragStatus: vi.fn(),
        setReplaceTransitionStatus: vi.fn()
      });
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "REPLACING",
        isActive: true,
        animHoldReleased: true
      });
      expect(scope.style.animation).toBe(""); // governed-compiled: the player does NOT drive (no inline pin)
      cleanup();
      scope.remove();
    } finally {
      Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
      Reflect.deleteProperty(navigator, "platform");
    }
  });

  it("a touch WebKit CHAINED navigation routes to the compiled tier (governed head)", () => {
    Object.defineProperty(navigator, "platform", { value: "iPhone", configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    const pending = vi
      .spyOn(TaskManager, "pendingTaskIds", "get")
      .mockReturnValue(["task-touch", "task-queued"]);
    try {
      const scope = document.createElement("div");
      document.body.appendChild(scope);
      const engine = createTransitionEngine({
        getTransitionTaskId: vi.fn(() => "task-touch"),
        setDragStatus: vi.fn(),
        setReplaceTransitionStatus: vi.fn()
      });
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      expect(scope.style.animation).toBe(""); // governed-compiled: the player does NOT drive (no inline pin)
      cleanup();
      scope.remove();
    } finally {
      pending.mockRestore();
      Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
      Reflect.deleteProperty(navigator, "platform");
    }
  });

  it("reported intervals are clamped and non-finite samples ignored", () => {
    reportDisplayIntervalMs(Number.NaN);
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 60, 1);
    reportDisplayIntervalMs(8);
    expect(learnedFrameIntervalMs()).toBeCloseTo(8, 1);
  });
});
