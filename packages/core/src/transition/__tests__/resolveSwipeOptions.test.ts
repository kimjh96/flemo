import { describe, expect, it, vi } from "vitest";

import resolveSwipeOptions, {
  DEFAULT_COMMIT_VELOCITY,
  DEFAULT_COMMIT_FRACTION
} from "@transition/resolveSwipeOptions";

import type { SwipeInfo, Transition } from "@transition/typing";

// A DIRECTION IS A COMPLETE SWIPE.
//
// A transition states as little as `{ direction }` and every caller downstream
// gets a complete answer: how far to commit, how fast, where the two sides
// are. These cases pin the defaults that fill those gaps, and the reading of
// each option a transition does name.

const transition = (options: Record<string, unknown>) =>
  ({ name: "resolve-test", initial: {}, variants: {}, ...options }) as unknown as Transition;

const info = (over: Partial<SwipeInfo> = {}): SwipeInfo => ({
  point: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
  ...over
});

describe("resolveSwipeOptions", () => {
  it("is null for a transition that declares no swipe at all", () => {
    // Which is how a transition opts OUT: there is no flag to turn off, so a
    // programmatic-only transition costs nothing and says nothing.
    expect(resolveSwipeOptions(transition({}))).toBeNull();
    expect(resolveSwipeOptions(transition({ swipe: undefined }))).toBeNull();
  });

  it("reads the axis the transition declared", () => {
    expect(resolveSwipeOptions(transition({ swipe: { direction: "y" } }))?.direction).toBe("y");
    expect(resolveSwipeOptions(transition({ swipe: { direction: "x" } }))?.direction).toBe("x");
  });

  it("hands back the hooks the transition wrote, and nothing it did not", () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const both = resolveSwipeOptions(
      transition({ swipe: { direction: "x", onStart, onMove, onEnd } })
    );

    expect(both?.onStart).toBe(onStart);
    expect(both?.onMove).toBe(onMove);
    expect(both?.onEnd).toBe(onEnd);

    const bare = resolveSwipeOptions(transition({ swipe: { direction: "x" } }));
    expect(bare?.onStart).toBeUndefined();
    expect(bare?.onMove).toBeUndefined();
    expect(bare?.onEnd).toBeUndefined();
  });

  it("keeps the screens for a transition that named where they go", () => {
    // Naming a destination is how a transition CLAIMS the screens, so a hook
    // written beside it drives everything else rather than taking them. The
    // gesture that carries a morphing element about is the reason: it needs a
    // hook for the element and nothing from the screens.
    const claimed = (options: Record<string, unknown>) =>
      resolveSwipeOptions(transition({ swipe: { direction: "x", ...options } }))?.drivesScreens;

    expect(claimed({ current: { x: "100%" }, onMove: vi.fn() })).toBe(true);
    expect(claimed({ prev: { x: 0 }, onEnd: vi.fn() })).toBe(true);
    // Without one, a hook still takes them: a drag that moves the screens
    // themselves to arbitrary places has to.
    expect(claimed({ onMove: vi.fn() })).toBe(false);
  });

  it("hands the screens back only while the transition drives neither phase", () => {
    const owns = (options: Record<string, unknown>) =>
      resolveSwipeOptions(transition({ swipe: { direction: "x", ...options } }))?.drivesScreens;

    // `onStart` only answers whether the gesture may begin, so it costs nothing.
    expect(owns({})).toBe(true);
    expect(owns({ onStart: vi.fn() })).toBe(true);
    expect(owns({ onMove: vi.fn() })).toBe(false);
    expect(owns({ onEnd: vi.fn() })).toBe(false);
  });

  describe("the distance a release has to have travelled", () => {
    it("defaults to the 50px-on-390 every preset used to carry", () => {
      const resolved = resolveSwipeOptions(transition({ swipe: { direction: "x" } }));
      expect(resolved?.commitDistance(390)).toBeCloseTo(50, 5);
      // Expressed as a fraction, so a wider screen asks for proportionally
      // more rather than the same 50px.
      expect(resolved?.commitDistance(780)).toBeCloseTo(100, 5);
      expect(DEFAULT_COMMIT_FRACTION).toBeCloseTo(50 / 390, 10);
    });

    it("takes a flat number as that distance outright", () => {
      const resolved = resolveSwipeOptions(
        transition({ swipe: { direction: "y", threshold: 56 } })
      );
      expect(resolved?.commitDistance(390)).toBe(56);
      expect(resolved?.commitDistance(1200)).toBe(56);
    });

    it("hands a function the screen's own span", () => {
      const resolved = resolveSwipeOptions(
        transition({ swipe: { direction: "x", threshold: (span: number) => span / 4 } })
      );
      expect(resolved?.commitDistance(400)).toBe(100);
    });
  });

  describe("where the two sides are along their travel", () => {
    const at = (options: Record<string, unknown>, span: number, travelled: number) =>
      resolveSwipeOptions(transition({ swipe: { direction: "x", ...options } }))?.progress(
        info({ offset: { x: travelled, y: 0 } }),
        span,
        travelled
      );

    it("defaults to how far the screen has been carried over its own box", () => {
      expect(at({}, 400, 100)).toEqual({ current: 0.25, prev: 0.25 });
    });

    it("reads a screen with no box yet as untravelled rather than as NaN", () => {
      // A screen measured before layout has a span of 0, and 0/0 would have
      // been written into a transform.
      expect(at({}, 0, 100)).toEqual({ current: 0, prev: 0 });
    });

    it("spreads a single declared number over both sides", () => {
      expect(at({ progress: () => 0.4 }, 400, 100)).toEqual({ current: 0.4, prev: 0.4 });
    });

    it("keeps two declared numbers apart", () => {
      // The case that put the pair in the type: material's two sides travel
      // different distances, so one scalar would have to be wrong about one
      // of them.
      expect(at({ progress: () => ({ current: 0.9, prev: 1 }) }, 400, 360)).toEqual({
        current: 0.9,
        prev: 1
      });
    });

    it("clamps whatever a transition returns into 0-1", () => {
      expect(at({ progress: () => ({ current: 2, prev: -1 }) }, 400, 100)).toEqual({
        current: 1,
        prev: 0
      });
      // Including the arithmetic a resistance curve can produce on its own:
      // a NaN scrub leaves the compiled animation at an undefined time.
      expect(at({ progress: () => Number.NaN }, 400, 100)).toEqual({ current: 0, prev: 0 });
      expect(at({ progress: () => Number.POSITIVE_INFINITY }, 400, 100)).toEqual({
        current: 1,
        prev: 1
      });
    });

    it("is handed the gesture itself, not just the geometry", () => {
      const progress = vi.fn(() => 0.5);
      at({ progress }, 400, 100);
      expect(progress).toHaveBeenCalledWith(
        expect.objectContaining({ offset: { x: 100, y: 0 } }),
        400
      );
    });
  });

  describe("the speed a release has to have kept", () => {
    it("defaults to the 20 every preset wrote for itself", () => {
      const resolved = resolveSwipeOptions(transition({ swipe: { direction: "x" } }));
      expect(resolved?.commitVelocity).toBe(DEFAULT_COMMIT_VELOCITY);
      expect(DEFAULT_COMMIT_VELOCITY).toBe(20);
    });

    it("takes the transition's own number when it names one", () => {
      // The reason this is authorable at all: a consumer transition asks for
      // 300, a fifteen times harder flick, and a declarative drag with no way
      // to name it would have to take over `onEnd` and lose the scrub for it.
      const resolved = resolveSwipeOptions(
        transition({ swipe: { direction: "x", velocity: 300 } })
      );
      expect(resolved?.commitVelocity).toBe(300);
    });

    it("reads a declared zero as zero, not as absent", () => {
      // `?? DEFAULT` rather than `|| DEFAULT`: 0 means any movement at all
      // commits, which is a thing a transition may want to say.
      const resolved = resolveSwipeOptions(transition({ swipe: { direction: "x", velocity: 0 } }));
      expect(resolved?.commitVelocity).toBe(0);
    });
  });
});
