import { describe, expect, it, vi } from "vitest";

import resolveSwipeOptions, {
  COMMIT_VELOCITY,
  DEFAULT_COMMIT_FRACTION
} from "@transition/resolveSwipeOptions";

import type { SwipeInfo, Transition } from "@transition/typing";

// ONE SHAPE, WHICHEVER WAY THE TRANSITION WROTE IT.
//
// `swipe: { direction }` is the surface; the flat `swipeDirection` and its
// three hooks are what flemo shipped first and still accepts. The point of
// reconciling them here is that no caller downstream has to know there were
// two, so these cases pin both readings and the defaults that fill the gaps.

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

  it("reads the nested form and the flat one alike", () => {
    expect(resolveSwipeOptions(transition({ swipe: { direction: "y" } }))?.direction).toBe("y");
    expect(resolveSwipeOptions(transition({ swipeDirection: "x" }))?.direction).toBe("x");
  });

  it("takes the flat hooks for a transition written before the nested form", () => {
    const onSwipeStart = vi.fn();
    const onSwipe = vi.fn();
    const onSwipeEnd = vi.fn();
    const resolved = resolveSwipeOptions(
      transition({ swipeDirection: "x", onSwipeStart, onSwipe, onSwipeEnd })
    );

    expect(resolved?.onStart).toBe(onSwipeStart);
    expect(resolved?.onMove).toBe(onSwipe);
    expect(resolved?.onEnd).toBe(onSwipeEnd);
  });

  it("does not mix the two forms when a transition declares `swipe`", () => {
    // A transition that moved to the nested form and left a stale flat hook
    // behind gets the form it wrote, not a merge of the two: a hook it thinks
    // it removed must not still be driving its drag.
    const stale = vi.fn();
    const resolved = resolveSwipeOptions(transition({ swipe: { direction: "x" }, onSwipe: stale }));

    expect(resolved?.onMove).toBeUndefined();
    expect(resolved?.drivesScreens).toBe(true);
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
      expect(at({}, 400, 100)).toEqual({ active: 0.25, passive: 0.25 });
    });

    it("reads a screen with no box yet as untravelled rather than as NaN", () => {
      // A screen measured before layout has a span of 0, and 0/0 would have
      // been written into a transform.
      expect(at({}, 0, 100)).toEqual({ active: 0, passive: 0 });
    });

    it("spreads a single declared number over both sides", () => {
      expect(at({ progress: () => 0.4 }, 400, 100)).toEqual({ active: 0.4, passive: 0.4 });
    });

    it("keeps two declared numbers apart", () => {
      // The case that put the pair in the type: material's two sides travel
      // different distances, so one scalar would have to be wrong about one
      // of them.
      expect(at({ progress: () => ({ active: 0.9, passive: 1 }) }, 400, 360)).toEqual({
        active: 0.9,
        passive: 1
      });
    });

    it("clamps whatever a transition returns into 0-1", () => {
      expect(at({ progress: () => ({ active: 2, passive: -1 }) }, 400, 100)).toEqual({
        active: 1,
        passive: 0
      });
      // Including the arithmetic a resistance curve can produce on its own:
      // a NaN scrub leaves the compiled animation at an undefined time.
      expect(at({ progress: () => Number.NaN }, 400, 100)).toEqual({ active: 0, passive: 0 });
      expect(at({ progress: () => Number.POSITIVE_INFINITY }, 400, 100)).toEqual({
        active: 1,
        passive: 1
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

  it("keeps the speed half of the verdict out of the transition's hands", () => {
    // Every preset had written the same 20, so it is a property of "the finger
    // was still going" rather than of any one transition. A transition that
    // wants a different rule takes over `onEnd` outright.
    expect(COMMIT_VELOCITY).toBe(20);
  });
});
