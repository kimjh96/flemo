import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import guardOpeningClock from "@core/engine/openingClockGuard";

// The guard is an rAF ticker; the queue and the clock are manual so each test
// scripts the exact frame cadence it wants to model.

let frameQueue: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let nowMs: number;

const runFrame = (at: number) => {
  nowMs = at;
  const callbacks = [...frameQueue.values()];
  frameQueue.clear();
  callbacks.forEach((callback) => callback(nowMs));
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

const NAME = "flemo-screen-tab-REPLACING-true";

describe("guardOpeningClock", () => {
  beforeEach(() => {
    frameQueue = new Map();
    nextFrameId = 1;
    nowMs = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frameQueue.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frameQueue.delete(id);
    });
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rewinds an eaten opening across every participant, on one shared clock", () => {
    // Measured WebKit shape: the release commit unpauses the fade, a refetch
    // commit blocks the main thread, and the first frame arrives with the
    // clock already deep into the motion — that span was never presented.
    const screen = fakeAnimation(NAME, 90);
    const bar = fakeAnimation(NAME, 80);
    const onRewind = vi.fn();
    const guard = guardOpeningClock(
      [
        { element: withAnimations([screen]), expectedName: NAME },
        { element: withAnimations([bar]), expectedName: NAME }
      ],
      { onRewind }
    );

    runFrame(90);
    // The largest advance past the one-frame budget (90 - 17 = 73) is the
    // group's lost span; every participant rewinds by exactly that.
    expect(screen.currentTime).toBe(17);
    expect(bar.currentTime).toBe(7);
    expect(onRewind).toHaveBeenCalledWith(73);
    expect(guard.appliedRewindMs()).toBe(73);
    expect(guard.settled()).toBe(true);
  });

  it("leaves a healthy clock alone (Blink defers the start; there is nothing to rewind)", () => {
    const screen = fakeAnimation(NAME, 20);
    const onRewind = vi.fn();
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }], {
      onRewind
    });

    runFrame(20);
    expect(screen.currentTime).toBe(20);
    expect(onRewind).not.toHaveBeenCalled();
    expect(guard.appliedRewindMs()).toBe(0);
    expect(guard.settled()).toBe(true);
  });

  it("first-frame-only by default: a later mid-flight gap is not watched without watchMs", () => {
    const screen = fakeAnimation(NAME, 10);
    guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }]);

    runFrame(10);
    // No further frame scheduled: the queue is empty.
    expect(frameQueue.size).toBe(0);
  });

  it("watches the whole flight: a mid-flight block is rewound at the next frame", () => {
    const screen = fakeAnimation(NAME, 16);
    const onRewind = vi.fn();
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }], {
      watchMs: 600,
      onRewind
    });

    // Healthy opening.
    runFrame(16);
    expect(screen.currentTime).toBe(16);
    screen.currentTime = 33;
    runFrame(33);
    expect(screen.currentTime).toBe(33);

    // A 70ms refetch-commit block: nothing presented, clock ran to 103.
    screen.currentTime = 103;
    runFrame(103);
    // Rewound to one frame past the last PRESENTED clock (33 + 17 = 50).
    expect(screen.currentTime).toBe(50);
    expect(guard.appliedRewindMs()).toBe(53);
    expect(onRewind).toHaveBeenLastCalledWith(53);

    // Rewinds accumulate: a second isolated block later in the flight.
    screen.currentTime = 66;
    runFrame(119);
    screen.currentTime = 146;
    runFrame(199);
    expect(screen.currentTime).toBe(83);
    expect(guard.appliedRewindMs()).toBe(116);
  });

  it("never rewinds a chronically slow cadence into slow motion", () => {
    // A 50ms-cadence device presents EVERY frame — motion on schedule, just
    // choppy. Only the first slow frame may rewind (the healthy→gap edge);
    // after that the guard must leave the clock alone.
    const screen = fakeAnimation(NAME, 50);
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }], {
      watchMs: 600
    });

    runFrame(50);
    const afterFirst = screen.currentTime!;
    expect(afterFirst).toBe(17); // the one healthy→gap rewind
    screen.currentTime = afterFirst + 50;
    runFrame(100);
    expect(screen.currentTime).toBe(afterFirst + 50);
    screen.currentTime = afterFirst + 100;
    runFrame(150);
    expect(screen.currentTime).toBe(afterFirst + 100);
    expect(guard.appliedRewindMs()).toBe(33);
  });

  it("stops watching at the window's end", () => {
    const screen = fakeAnimation(NAME, 16);
    guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }], {
      watchMs: 100
    });

    runFrame(16);
    expect(frameQueue.size).toBe(1);
    runFrame(80);
    expect(frameQueue.size).toBe(1);
    runFrame(150);
    expect(frameQueue.size).toBe(0);
  });

  it("only reads the expected compiled animation and skips unresolved clocks", () => {
    const foreign = fakeAnimation("consumer-shimmer", 500);
    const unresolved = fakeAnimation(NAME, null);
    guardOpeningClock([{ element: withAnimations([foreign, unresolved]), expectedName: NAME }]);

    runFrame(90);
    expect(foreign.currentTime).toBe(500);
    expect(unresolved.currentTime).toBeNull();
  });

  it("cancel prevents the correction and reports unsettled", () => {
    const screen = fakeAnimation(NAME, 90);
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }]);

    guard.cancel();
    runFrame(90);
    expect(screen.currentTime).toBe(90);
    expect(guard.settled()).toBe(false);
  });

  it("cancel mid-watch stops the ticker", () => {
    const screen = fakeAnimation(NAME, 16);
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }], {
      watchMs: 600
    });
    runFrame(16);
    expect(frameQueue.size).toBe(1);
    guard.cancel();
    expect(frameQueue.size).toBe(0);
  });

  it("degrades to a no-op without rAF or per-element getAnimations", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    const guard = guardOpeningClock([
      { element: document.createElement("div"), expectedName: NAME }
    ]);
    expect(guard.appliedRewindMs()).toBe(0);
    expect(guard.settled()).toBe(true);
    expect(() => guard.cancel()).not.toThrow();
  });
});
