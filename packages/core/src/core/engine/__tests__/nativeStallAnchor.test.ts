import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NATIVE_STALL_STEP_MS,
  watchNativeStalls,
  anchorNativeFlightStart,
  holdNativeClocksToFirstFrame
} from "@core/engine/nativeStallAnchor";

interface FakeAnimation {
  animationName?: string;
  playState: string;
  startTime: number | null;
}

const fakeElement = (animations: FakeAnimation[]) => {
  const seenOptions: unknown[] = [];
  const element = {
    getAnimations: (options?: unknown) => {
      seenOptions.push(options);
      return animations;
    }
  } as unknown as HTMLElement;
  return { element, seenOptions };
};

describe("watchNativeStalls", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const pump = (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(time));
  };

  beforeEach(() => {
    frames = new Map();
    frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.set(++frameId, frameCallback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames.delete(handle);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ordinary frame gaps shift nothing", () => {
    const animation: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 100
    };
    const { element } = fakeElement([animation]);
    const onStall = vi.fn();
    const detach = watchNativeStalls(() => [element], onStall);

    pump(0);
    pump(17);
    pump(33); // a natural double-vsync gap sits inside the step cap
    expect(animation.startTime).toBe(100);
    expect(onStall).not.toHaveBeenCalled();
    detach();
  });

  it("a stall shifts running flemo animations by the excess and reports it", () => {
    const screen: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 100
    };
    const consumer: FakeAnimation = {
      animationName: "skeleton-wave",
      playState: "running",
      startTime: 100
    };
    const paused: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-false",
      playState: "paused",
      startTime: 100
    };
    const pending: FakeAnimation = {
      animationName: "flemo-decorator-overlay-PUSHING-false",
      playState: "running",
      startTime: null
    };
    const { element, seenOptions } = fakeElement([screen, consumer, paused, pending]);
    const onStall = vi.fn();
    const detach = watchNativeStalls(() => [element], onStall);

    pump(0);
    pump(100); // a 100ms stall → excess ≈ 100 − two frames
    const excess = 100 - NATIVE_STALL_STEP_MS;
    expect(screen.startTime).toBeCloseTo(100 + excess, 5);
    // Consumer animations, paused holds, and pending start times are left
    // alone — only running flemo timelines re-anchor.
    expect(consumer.startTime).toBe(100);
    expect(paused.startTime).toBe(100);
    expect(pending.startTime).toBeNull();
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(onStall.mock.calls[0]![0]).toBeCloseTo(excess, 5);
    // The first element is searched subtree-wide (parts live inside the
    // scope); the option object is what jsdom-free runtimes receive.
    expect(seenOptions[0]).toEqual({ subtree: true });
    detach();
  });

  it("every element is searched subtree-wide (sibling screens carry their own participants)", () => {
    const screenAnim: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 0
    };
    const siblingAnim: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-false",
      playState: "running",
      startTime: 0
    };
    const scope = fakeElement([screenAnim]);
    const sibling = fakeElement([siblingAnim]);
    const detach = watchNativeStalls(() => [scope.element, sibling.element, null]);

    pump(0);
    pump(200);
    expect(screenAnim.startTime).toBeGreaterThan(0);
    // The covered parallax side re-anchors WITH the active side — a shift
    // that skips it makes the sibling teleport the stalled span.
    expect(siblingAnim.startTime).toBeGreaterThan(0);
    expect(sibling.seenOptions[0]).toEqual({ subtree: true });
    detach();
  });

  it("overlapping watchers in the same frame shift an animation once", () => {
    const shared: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-false",
      playState: "running",
      startTime: 0
    };
    const first = fakeElement([shared]);
    const second = fakeElement([shared]);
    // Two watchers (two engines) covering the SAME participant, both primed
    // on the same frame cadence.
    const detachFirst = watchNativeStalls(() => [first.element]);
    const detachSecond = watchNativeStalls(() => [second.element]);

    pump(0);
    pump(100);
    const excess = 100 - NATIVE_STALL_STEP_MS;
    // One stall, one shift — the same-frame timestamp dedups the second
    // watcher's delivery.
    expect(shared.startTime).toBeCloseTo(excess, 5);
    detachFirst();
    detachSecond();
  });

  it("an element without getAnimations is skipped", () => {
    const bare = {} as unknown as HTMLElement;
    const detach = watchNativeStalls(() => [bare]);
    pump(0);
    pump(200); // must not throw
    detach();
  });

  it("detach stops the watcher, and a late frame callback is inert", () => {
    const animation: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 0
    };
    const { element } = fakeElement([animation]);
    const detach = watchNativeStalls(() => [element]);
    pump(0);
    // A callback the scheduler already dispatched can still fire after the
    // detach: it must do nothing.
    const pending = [...frames.values()];
    detach();
    pending.forEach((frameCallback) => frameCallback(500));
    pump(500);
    expect(animation.startTime).toBe(0);
    expect(frames.size).toBe(0);
  });
});

describe("anchorNativeFlightStart", () => {
  const GUARD = 4000; // START_HOLD_GUARD_MS
  const makeAnimation = (currentTime: number, name = "flemo-screen-x-PUSHING-true") =>
    ({
      animationName: name,
      playState: "running",
      currentTime,
      startTime: 1000
    }) as unknown as CSSAnimation;

  const host = (animations: Animation[]) => {
    const el = document.createElement("div");
    (el as unknown as { getAnimations: unknown }).getAnimations = () => animations;
    return el;
  };

  const queuedRaf = () => {
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
    return { rafCbs, raf };
  };

  it("the first tick holds every fresh clock in the future (from-pose through the release block)", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const detach = anchorNativeFlightStart(() => [host([fresh])]);
    rafCbs.shift()!(0); // HOLD: the block's own present now shows the from pose
    expect(fresh.startTime).toBe(1000 + GUARD);
    detach();
    raf.mockRestore();
  });

  it("the restore tick lands the clock on base+allowance and reports the block", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const onShift = vi.fn();
    const detach = anchorNativeFlightStart(() => [host([fresh])], onShift);
    rafCbs.shift()!(0); // hold
    // The release block ran 150ms; the (guarded) clock aged with it.
    (fresh as unknown as { currentTime: number }).currentTime = 2 + 150 - GUARD;
    rafCbs.shift()!(150); // restore
    const allowance = NATIVE_STALL_STEP_MS; // 150ms gap, capped
    const desired = 2 + allowance;
    // Net effect: the block's span beyond the allowance was given back.
    expect(fresh.startTime).toBeCloseTo(1000 + (150 - allowance), 5);
    expect(onShift).toHaveBeenCalledTimes(1);
    expect(onShift.mock.calls[0]![0]).toBeCloseTo(2 + 150 - desired, 5);
    detach();
    raf.mockRestore();
  });

  it("a healthy flight's hold+restore is a numeric no-op and never fires onShift", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const onShift = vi.fn();
    const detach = anchorNativeFlightStart(() => [host([fresh])], onShift);
    rafCbs.shift()!(1000); // hold
    (fresh as unknown as { currentTime: number }).currentTime = 2 + 16 - GUARD;
    rafCbs.shift()!(1016); // restore: guard out, one frame's allowance in
    expect(fresh.startTime).toBeCloseTo(1000, 5);
    expect(onShift).not.toHaveBeenCalled();
    // The co-flush watch stands down at the window bound without writing.
    let t = 1016;
    let ct = 18;
    while (rafCbs.length > 0) {
      t += 16;
      ct += 16;
      (fresh as unknown as { currentTime: number }).currentTime = ct;
      rafCbs.shift()!(t);
      if (t > 3000) break; // safety
    }
    expect(t).toBeLessThan(1400);
    expect(fresh.startTime).toBeCloseTo(1000, 5);
    expect(onShift).not.toHaveBeenCalled();
    detach();
    raf.mockRestore();
  });

  it("covers a block that lands AFTER the restore (the co-flush window)", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const onShift = vi.fn();
    const detach = anchorNativeFlightStart(() => [host([fresh])], onShift);
    rafCbs.shift()!(1000); // hold
    (fresh as unknown as { currentTime: number }).currentTime = 2 + 16 - GUARD;
    rafCbs.shift()!(1016); // restore → base 18, allowance resets
    // A 300ms co-flushed block: allowance caps at one step, the rest rewinds.
    (fresh as unknown as { currentTime: number }).currentTime = 18 + 300;
    rafCbs.shift()!(1316);
    const allowed = 18 + NATIVE_STALL_STEP_MS;
    expect(fresh.startTime).toBeCloseTo(1000 + (18 + 300 - allowed), 5);
    expect(onShift).toHaveBeenCalledTimes(1);
    expect(rafCbs.length).toBe(0); // the first co-flush rewind ends the watch
    detach();
    raf.mockRestore();
  });

  it("a detach between hold and restore gives the guard back", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const detach = anchorNativeFlightStart(() => [host([fresh])]);
    rafCbs.shift()!(0); // hold
    (fresh as unknown as { currentTime: number }).currentTime = 2 + 30 - GUARD;
    detach();
    // Restored with the one-step allowance — never stranded in the future.
    expect(fresh.startTime).toBeCloseTo(1000 + (30 - NATIVE_STALL_STEP_MS), 5);
    raf.mockRestore();
  });

  it("holdFirstFrame=false skips the hold (REPLACING) and keeps the legacy rewind", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const onShift = vi.fn();
    const detach = anchorNativeFlightStart(() => [host([fresh])], onShift, false);
    rafCbs.shift()!(0); // no hold: startTime untouched, watch begins
    expect(fresh.startTime).toBe(1000);
    // A 150ms release block: the one-shot rewind covers it, one frame late.
    (fresh as unknown as { currentTime: number }).currentTime = 2 + 150;
    rafCbs.shift()!(150);
    const allowed = 2 + NATIVE_STALL_STEP_MS;
    expect(fresh.startTime).toBeCloseTo(1000 + (2 + 150 - allowed), 5);
    expect(onShift).toHaveBeenCalledTimes(1);
    detach();
    raf.mockRestore();
  });

  it("firstTickOnly rewinds the release-frame aging at tick one and stands down for good", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const onShift = vi.fn();
    const detach = anchorNativeFlightStart(() => [host([fresh])], onShift, false, true);
    // One LPM frame (48ms) of clock aging between the release microtask and
    // the first rendering update — nothing has presented yet.
    (fresh as unknown as { currentTime: number }).currentTime = 2 + 48;
    rafCbs.shift()!(48);
    const allowed = 2 + NATIVE_STALL_STEP_MS;
    expect(fresh.startTime).toBeCloseTo(1000 + (2 + 48 - allowed), 5);
    expect(onShift).toHaveBeenCalledTimes(1);
    // Stands down: no co-flush watch — later capped-rAF gaps (which are NOT
    // presentation gaps under LPM) can never rewind the presenting flight.
    expect(rafCbs.length).toBe(0);
    // Detach after the tick must not restore-guard the clock backwards.
    const settled = fresh.startTime;
    detach();
    expect(fresh.startTime).toBe(settled);
    raf.mockRestore();
  });

  it("firstTickOnly leaves a barely-aged clock untouched and never fires onShift", () => {
    const fresh = makeAnimation(2);
    const { rafCbs, raf } = queuedRaf();
    const onShift = vi.fn();
    const detach = anchorNativeFlightStart(() => [host([fresh])], onShift, false, true);
    (fresh as unknown as { currentTime: number }).currentTime = 2 + 30; // inside one step
    rafCbs.shift()!(30);
    expect(fresh.startTime).toBe(1000);
    expect(onShift).not.toHaveBeenCalled();
    expect(rafCbs.length).toBe(0);
    detach();
    raf.mockRestore();
  });

  it("a PENDING clock (currentTime null at the release microtask) is held via the timeline", () => {
    // The exact birth state at the release microtask: currentTime and
    // startTime both null (play pending, resolving only at the first render
    // tick — AFTER the block). The hold must pin an explicit future start
    // off the document timeline, or the anchor silently no-ops on the very
    // flights it exists for.
    const pending = {
      animationName: "flemo-screen-x-PUSHING-true",
      playState: "running",
      currentTime: null,
      startTime: null,
      timeline: { currentTime: 500 }
    } as unknown as CSSAnimation;
    const { rafCbs, raf } = queuedRaf();
    const detach = anchorNativeFlightStart(() => [host([pending])]);
    rafCbs.shift()!(0); // hold
    expect(pending.startTime).toBe(500 + GUARD);
    detach();
    raf.mockRestore();
  });

  it("never touches a mid-flight animation (an effect re-run) or the same animation twice", () => {
    const midFlight = makeAnimation(300);
    const { rafCbs, raf } = queuedRaf();
    anchorNativeFlightStart(() => [host([midFlight])]);
    while (rafCbs.length) rafCbs.shift()!(performance.now());
    expect(midFlight.startTime).toBe(1000); // never collected, never held

    // A fresh one, anchored once; a second arming must not re-anchor it.
    const fresh = makeAnimation(0);
    const detach = anchorNativeFlightStart(() => [host([fresh])]);
    rafCbs.shift()!(0); // hold
    const heldStart = fresh.startTime;
    expect(heldStart).toBe(1000 + GUARD);
    const detachSecond = anchorNativeFlightStart(() => [host([fresh])]);
    expect(fresh.startTime).toBe(heldStart); // startAnchored remembers the object
    detach();
    detachSecond();
    raf.mockRestore();
  });
});

describe("holdNativeClocksToFirstFrame", () => {
  const makeScope = () => {
    const scope = document.createElement("div");
    scope.setAttribute("data-flemo-anim-hold", "true");
    document.body.appendChild(scope);
    return scope;
  };

  const makeAnim = (currentTime: number) => {
    const calls: string[] = [];
    const state = { playState: "running" };
    const animation = {
      animationName: "flemo-screen-x-PUSHING-true",
      get playState() {
        return state.playState;
      },
      currentTime,
      startTime: 0,
      pause() {
        calls.push("pause");
        state.playState = "paused";
      },
      play() {
        calls.push("play");
        state.playState = "running";
      }
    } as unknown as CSSAnimation;
    return { calls, animation };
  };

  it("pauses just-born clocks at the release and plays them on the next frame", async () => {
    const scope = makeScope();
    const { animation, calls } = makeAnim(2);
    const target = document.createElement("div");
    (target as unknown as { getAnimations: unknown }).getAnimations = () => [animation];
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCbs.push(cb);
        return rafCbs.length;
      });
    const onHeld = vi.fn();
    holdNativeClocksToFirstFrame(scope, () => [target], onHeld);

    scope.setAttribute("data-flemo-anim-hold", "false");
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Paused inside the release's microtask — before the frame can paint.
    expect(calls).toEqual(["pause"]);

    // Engage schedules the resume AND the early stall watcher's loop; fire
    // the batch scheduled so far once, like one frame would.
    for (const cb of rafCbs.splice(0)) cb(performance.now());
    expect(calls).toEqual(["pause", "play"]);
    expect(onHeld).toHaveBeenCalledTimes(1);
    raf.mockRestore();
    scope.remove();
  });

  it("leaves aged clocks (a mid-flight re-arm) untouched", async () => {
    const scope = makeScope();
    const { animation, calls } = makeAnim(300);
    const target = document.createElement("div");
    (target as unknown as { getAnimations: unknown }).getAnimations = () => [animation];
    holdNativeClocksToFirstFrame(scope, () => [target]);
    scope.setAttribute("data-flemo-anim-hold", "false");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual([]);
    scope.remove();
  });

  it("a detach BEFORE the resume frame plays the held clocks and cancels the backstop", async () => {
    vi.useFakeTimers();
    const scope = makeScope();
    const { animation, calls } = makeAnim(2);
    const target = document.createElement("div");
    (target as unknown as { getAnimations: unknown }).getAnimations = () => [animation];
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
    const onHeld = vi.fn();
    const dispose = holdNativeClocksToFirstFrame(scope, () => [target], onHeld);

    scope.setAttribute("data-flemo-anim-hold", "false");
    await Promise.resolve();
    expect(calls).toEqual(["pause"]); // engaged: the clock is held

    // Teardown BEFORE the resume rAF fires: it must play the held clock (never
    // leave it frozen) but NOT call onHeld (a superseding transition owns the
    // scope now).
    dispose();
    expect(calls).toEqual(["pause", "play"]);
    expect(onHeld).not.toHaveBeenCalled();

    // The internal 1s backstop must be cancelled — no stale resume/onHeld.
    vi.advanceTimersByTime(2000);
    for (const cb of rafCbs.splice(0)) cb(0);
    expect(onHeld).not.toHaveBeenCalled();
    expect(calls).toEqual(["pause", "play"]); // no second play

    raf.mockRestore();
    vi.useRealTimers();
    scope.remove();
  });
});
