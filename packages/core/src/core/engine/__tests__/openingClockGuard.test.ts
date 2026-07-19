import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import guardOpeningClock from "@core/engine/openingClockGuard";

// The guard is a SINGLE-frame corrector: its rAF runs inside the first
// rendering update after the release commit, before that update paints.
// The queue and the clock are manual so each test scripts the exact frame
// it wants to model.

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
    // The swallowed-opening shape: the release unpauses the fade, a blocked
    // commit starves rAF, and the first rendering update arrives with the
    // clock already deep into the motion. Nothing has been committed to the
    // compositor yet, so the rewind lands before anything paints.
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

  it("leaves a healthy clock alone (nothing was eaten; there is nothing to rewind)", () => {
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

  it("corrects exactly one frame: later gaps belong to the compositor and never rewind", () => {
    // Once the first rendering update has committed the animation, the
    // compositor owns it and presents straight through a main-thread gap —
    // measured on a production device as a tab fade committed with clock 0,
    // a 65ms rAF gap the compositor presented through, then a (since
    // removed) rewind from 65ms to 17ms blinking the whole screen. The
    // guard therefore never schedules a second frame.
    const screen = fakeAnimation(NAME, 2);
    const onRewind = vi.fn();
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }], {
      onRewind
    });

    runFrame(2);
    expect(frameQueue.size).toBe(0); // no ticker — the window is one frame

    // The later gap: the clock lands wherever the wall put it, untouched.
    screen.currentTime = 65;
    expect(guard.appliedRewindMs()).toBe(0);
    expect(onRewind).not.toHaveBeenCalled();
  });

  it("a slow first frame corrects once, before anything has painted", () => {
    // A 50ms-cadence device: the first update since the release runs at
    // 50ms. Nothing presented before it, so the one correction is invisible
    // and the motion starts whole; afterwards the guard is done.
    const screen = fakeAnimation(NAME, 50);
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }]);

    runFrame(50);
    expect(screen.currentTime).toBe(17);
    expect(guard.appliedRewindMs()).toBe(33);
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

  it("survives an animation that rejects the seek", () => {
    const brittle = fakeAnimation(NAME, 90);
    Object.defineProperty(brittle, "currentTime", {
      get: () => 90,
      set: () => {
        throw new DOMException("InvalidState");
      }
    });
    const guard = guardOpeningClock([{ element: withAnimations([brittle]), expectedName: NAME }]);

    expect(() => runFrame(90)).not.toThrow();
    // The rewind is still reported: the group's presented-timeline shift is
    // what downstream arithmetic (perceptual cut, cancel-resume) consumes.
    expect(guard.appliedRewindMs()).toBe(73);
  });

  it("cancel prevents the correction and reports unsettled", () => {
    const screen = fakeAnimation(NAME, 90);
    const guard = guardOpeningClock([{ element: withAnimations([screen]), expectedName: NAME }]);

    guard.cancel();
    runFrame(90);
    expect(screen.currentTime).toBe(90);
    expect(guard.settled()).toBe(false);
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
