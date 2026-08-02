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

  it("rewinds a just-started clock that aged past its allowance before first rAF", () => {
    const fresh = makeAnimation(2);
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
    const onShift = vi.fn();
    anchorNativeFlightStart(() => [host([fresh])], onShift);
    // The release frame's own rendering update blocked: by the first rAF the
    // clock aged 150ms. Budget = base(2) + one-step slack: the excess is
    // given back to the timeline.
    (fresh as unknown as { currentTime: number }).currentTime = 150;
    rafCbs.shift()!(0);
    expect(fresh.startTime).toBeCloseTo(1000 + (150 - 2), 5); // rewound to its base exactly
    expect(onShift).toHaveBeenCalled();
    expect(rafCbs.length).toBe(0); // one rewind ends the watch
    raf.mockRestore();
  });

  it("covers a block that lands AFTER a clean first frame (the co-flush window)", () => {
    const fresh = makeAnimation(2);
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
    const onShift = vi.fn();
    anchorNativeFlightStart(() => [host([fresh])], onShift);
    // Frame 1: healthy — nothing written, the watch continues.
    (fresh as unknown as { currentTime: number }).currentTime = 16;
    rafCbs.shift()!(1000);
    expect(fresh.startTime).toBe(1000);
    // Frame 2 arrives 300ms late (the release frame's co-flushed update).
    // Allowance for the gap is capped at one player step; the rest rewinds.
    (fresh as unknown as { currentTime: number }).currentTime = 316;
    rafCbs.shift()!(1300);
    const allowed = 2 + NATIVE_STALL_STEP_MS; /* base + capped gap allowance */
    expect(fresh.startTime).toBeCloseTo(1000 + (316 - allowed), 5);
    expect(onShift).toHaveBeenCalledTimes(1);
    expect(rafCbs.length).toBe(0);
    raf.mockRestore();
  });

  it("stands down at the window bound without touching a healthy flight", () => {
    const fresh = makeAnimation(2);
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
    const onShift = vi.fn();
    anchorNativeFlightStart(() => [host([fresh])], onShift);
    let t = 1000;
    let ct = 10;
    while (rafCbs.length > 0) {
      (fresh as unknown as { currentTime: number }).currentTime = ct;
      rafCbs.shift()!(t);
      t += 16;
      ct += 16;
      if (t > 3000) break; // safety: the window must terminate long before
    }
    expect(t).toBeLessThan(1400); // ~150ms window, not an endless watch
    expect(fresh.startTime).toBe(1000);
    expect(onShift).not.toHaveBeenCalled();
    raf.mockRestore();
  });

  it("never touches a mid-flight animation (an effect re-run) or the same animation twice", () => {
    const midFlight = makeAnimation(300);
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(performance.now());
        return 1;
      });
    anchorNativeFlightStart(() => [host([midFlight])]);
    expect(midFlight.startTime).toBe(1000);

    // A fresh one, anchored once; a second arming must not re-anchor it.
    const fresh = makeAnimation(0);
    let age = 0;
    Object.defineProperty(fresh, "currentTime", { get: () => age, configurable: true });
    age = 100;
    anchorNativeFlightStart(() => [host([fresh])]);
    const after = fresh.startTime;
    age = 100; // fresh-looking? no: startAnchored remembers the object
    anchorNativeFlightStart(() => [host([fresh])]);
    expect(fresh.startTime).toBe(after);
    raf.mockRestore();
  });

  it("a healthy first frame is a no-op", () => {
    const fresh = makeAnimation(2);
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
    const onShift = vi.fn();
    anchorNativeFlightStart(() => [host([fresh])], onShift);
    (fresh as unknown as { currentTime: number }).currentTime = 16;
    rafCbs.shift()!(0);
    expect(fresh.startTime).toBe(1000);
    expect(onShift).not.toHaveBeenCalled();
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
});
