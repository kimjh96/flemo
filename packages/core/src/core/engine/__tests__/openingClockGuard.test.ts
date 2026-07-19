import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import guardOpeningClock from "@core/engine/openingClockGuard";

// The guard's whole job happens in one rAF; the queue is manual so each test
// decides when "the first frame after the release" runs.

let frameQueue: Map<number, FrameRequestCallback>;
let nextFrameId: number;

const runFrames = () => {
  const callbacks = [...frameQueue.values()];
  frameQueue.clear();
  callbacks.forEach((callback) => callback(performance.now()));
};

const fakeAnimation = (animationName: string, currentTime: number | null) => {
  const animation = { animationName, currentTime };
  return animation as unknown as Animation & { currentTime: number | null };
};

const withAnimations = (animations: Animation[]) => {
  const element = document.createElement("div");
  Object.defineProperty(element, "getAnimations", {
    configurable: true,
    value: () => animations
  });
  return element;
};

describe("guardOpeningClock", () => {
  beforeEach(() => {
    frameQueue = new Map();
    nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frameQueue.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frameQueue.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rewinds an opening the main thread ate, across every participant, on one shared clock", () => {
    // Measured WebKit shape: the release commit unpauses the fade, a refetch
    // commit blocks the main thread, and the first frame arrives with the
    // clock already deep into the motion — that span was never presented.
    const screen = fakeAnimation("flemo-screen-tab-REPLACING-true", 90);
    const bar = fakeAnimation("flemo-screen-tab-REPLACING-true", 80);
    const onRewind = vi.fn();
    const guard = guardOpeningClock(
      [
        { element: withAnimations([screen]), expectedName: "flemo-screen-tab-REPLACING-true" },
        { element: withAnimations([bar]), expectedName: "flemo-screen-tab-REPLACING-true" }
      ],
      onRewind
    );

    runFrames();
    // The largest advancement past the one-frame mark (90 - 17 = 73) is the
    // group's lost span; every participant rewinds by exactly that.
    expect(screen.currentTime).toBe(17);
    expect(bar.currentTime).toBe(7);
    expect(onRewind).toHaveBeenCalledWith(73);
    expect(guard.appliedRewindMs()).toBe(73);
    expect(guard.settled()).toBe(true);
  });

  it("leaves a healthy clock alone (Blink defers the start; there is nothing to rewind)", () => {
    const screen = fakeAnimation("flemo-screen-tab-REPLACING-true", 20);
    const onRewind = vi.fn();
    const guard = guardOpeningClock(
      [{ element: withAnimations([screen]), expectedName: "flemo-screen-tab-REPLACING-true" }],
      onRewind
    );

    runFrames();
    expect(screen.currentTime).toBe(20);
    expect(onRewind).not.toHaveBeenCalled();
    expect(guard.appliedRewindMs()).toBe(0);
    expect(guard.settled()).toBe(true);
  });

  it("only reads the expected compiled animation and skips unresolved clocks", () => {
    const foreign = fakeAnimation("consumer-shimmer", 500);
    const unresolved = fakeAnimation("flemo-screen-tab-REPLACING-true", null);
    guardOpeningClock([
      {
        element: withAnimations([foreign, unresolved]),
        expectedName: "flemo-screen-tab-REPLACING-true"
      }
    ]);

    runFrames();
    expect(foreign.currentTime).toBe(500);
    expect(unresolved.currentTime).toBeNull();
  });

  it("cancel prevents the correction and reports unsettled", () => {
    const screen = fakeAnimation("flemo-screen-tab-REPLACING-true", 90);
    const guard = guardOpeningClock([
      { element: withAnimations([screen]), expectedName: "flemo-screen-tab-REPLACING-true" }
    ]);

    guard.cancel();
    runFrames();
    expect(screen.currentTime).toBe(90);
    expect(guard.settled()).toBe(false);
  });

  it("degrades to a no-op without rAF or per-element getAnimations", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    const guard = guardOpeningClock([
      { element: document.createElement("div"), expectedName: "flemo-screen-tab-REPLACING-true" }
    ]);
    expect(guard.appliedRewindMs()).toBe(0);
    expect(guard.settled()).toBe(true);
    expect(() => guard.cancel()).not.toThrow();
  });
});
