import { describe, expect, it, vi } from "vitest";

import cupertinoPreset from "@transition/cupertino";
import layoutPreset from "@transition/layout";
import materialPreset from "@transition/material";

import type {
  BaseTransition,
  SwipeAnimate,
  SwipeInfo,
  TransitionOptions
} from "@transition/typing";

// The presets all declare swipe callbacks; narrow the Transition union so the
// callbacks are directly invocable in the tests.
type SwipeTransition = BaseTransition & Extract<TransitionOptions, { swipeDirection: "x" | "y" }>;

import overlay from "@transition/decorator/overlay";

// The presets' swipe callbacks drive inline animations from gesture info.
// They are pure over (info, context): feed a spy `animate` and assert the
// targets/values, covering the triggered and cancelled branches of each.

const swipeInfo = (overrides: Partial<SwipeInfo> = {}): SwipeInfo => ({
  point: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
  ...overrides
});

const context = () => {
  const animate = vi.fn().mockResolvedValue(undefined) as unknown as SwipeAnimate;
  return {
    animate,
    calls: animate as unknown as ReturnType<typeof vi.fn>,
    currentScreen: document.createElement("div"),
    prevScreen: document.createElement("div"),
    currentDecorator: document.createElement("div"),
    prevDecorator: document.createElement("div")
  };
};

const pointerEvent = {} as PointerEvent;

const cupertino = cupertinoPreset as unknown as SwipeTransition;
const material = materialPreset as unknown as SwipeTransition;
const layout = layoutPreset as unknown as SwipeTransition;

describe("cupertino swipe", () => {
  it("starts a swipe unconditionally", async () => {
    await expect(cupertino.onSwipeStart!(pointerEvent, swipeInfo(), context())).resolves.toBe(true);
  });

  it("maps the horizontal drag to screen offsets and progress", () => {
    const ctx = context();
    const onProgress = vi.fn();
    const progress = cupertino.onSwipe!(
      pointerEvent,
      swipeInfo({ offset: { x: window.innerWidth / 2, y: 0 } }),
      { ...ctx, onProgress }
    );

    expect(progress).toBeCloseTo(50);
    expect(onProgress).toHaveBeenCalledWith(true, expect.closeTo(50, 1));
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ x: window.innerWidth / 2 }),
      expect.objectContaining({ duration: 0 })
    );
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevScreen,
      expect.anything(),
      expect.objectContaining({ duration: 0 })
    );
  });

  it("commits the pop when the drag crosses the trigger threshold", async () => {
    const ctx = context();
    const onStart = vi.fn();
    const triggered = await cupertino.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: window.innerWidth, y: 0 }, velocity: { x: 30, y: 0 } }),
      { ...ctx, onStart }
    );

    expect(triggered).toBe(true);
    expect(onStart).toHaveBeenCalledWith(true);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ x: "100%" }),
      expect.anything()
    );
  });

  it("cancels back to rest under the threshold", async () => {
    const ctx = context();
    const triggered = await cupertino.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 4, y: 0 }, velocity: { x: 0, y: 0 } }),
      ctx
    );

    expect(triggered).toBe(false);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ x: 0 }),
      expect.anything()
    );
  });
});

describe("material swipe", () => {
  it("starts a swipe unconditionally", async () => {
    await expect(material.onSwipeStart!(pointerEvent, swipeInfo(), context())).resolves.toBe(true);
  });

  it("clamps the vertical drag with resistance past the threshold", () => {
    const ctx = context();
    const onProgress = vi.fn();
    const progress = material.onSwipe!(pointerEvent, swipeInfo({ offset: { x: 0, y: 300 } }), {
      ...ctx,
      onProgress
    });

    // 56px clamp + resisted extra, progress capped at the clamp.
    expect(progress).toBeLessThanOrEqual(56);
    expect(onProgress).toHaveBeenCalled();
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ y: expect.any(Number) }),
      expect.objectContaining({ duration: 0 })
    );
  });

  it("commits on a long or fast downward drag, cancels otherwise", async () => {
    const commit = await material.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 0, y: 200 }, velocity: { x: 0, y: 0 } }),
      context()
    );
    expect(commit).toBe(true);

    const cancel = await material.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 0, y: 10 }, velocity: { x: 0, y: 0 } }),
      context()
    );
    expect(cancel).toBe(false);
  });
});

describe("layout swipe", () => {
  it("starts a swipe unconditionally", async () => {
    await expect(layout.onSwipeStart!(pointerEvent, swipeInfo(), context())).resolves.toBe(true);
  });

  it("fades and offsets the screen with resistance on drag", () => {
    const ctx = context();
    const onProgress = vi.fn();
    const progress = layout.onSwipe!(pointerEvent, swipeInfo({ offset: { x: 0, y: 40 } }), {
      ...ctx,
      onProgress
    });

    expect(progress).toBe(40);
    expect(onProgress).toHaveBeenCalledWith(true, 100);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ y: 40, opacity: expect.any(Number) }),
      expect.objectContaining({ duration: 0 })
    );
  });

  it("never lets the screen travel upward (negative drag clamps to 0)", () => {
    const ctx = context();
    layout.onSwipe!(pointerEvent, swipeInfo({ offset: { x: 0, y: -30 } }), ctx);

    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ y: 0 }),
      expect.anything()
    );
  });

  it("commits past the drag threshold and restores under it", async () => {
    const commitCtx = context();
    const onStart = vi.fn();
    const commit = await layout.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 0, y: 120 }, velocity: { x: 0, y: 0 } }),
      { ...commitCtx, onStart }
    );
    expect(commit).toBe(true);
    expect(onStart).toHaveBeenCalledWith(true);
    expect(commitCtx.calls).toHaveBeenCalledWith(
      commitCtx.currentScreen,
      expect.objectContaining({ y: "100%" }),
      expect.anything()
    );

    const cancel = await layout.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 0, y: 8 }, velocity: { x: 0, y: 0 } }),
      context()
    );
    expect(cancel).toBe(false);
  });
});

describe("overlay decorator swipe", () => {
  it("dims in/out on swipe start according to the trigger", async () => {
    const ctx = context();
    await overlay.onSwipeStart!(true, ctx);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevDecorator,
      { opacity: 1 },
      expect.objectContaining({ duration: 0.3 })
    );

    const ctx2 = context();
    await overlay.onSwipeStart!(false, ctx2);
    expect(ctx2.calls).toHaveBeenCalledWith(ctx2.prevDecorator, { opacity: 0 }, expect.anything());
  });

  it("tracks the drag progress inversely on the dim", () => {
    const ctx = context();
    overlay.onSwipe!(true, 25, ctx);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevDecorator,
      { opacity: 0.75 },
      expect.objectContaining({ duration: 0 })
    );
  });

  it("settles the dim on swipe end according to the trigger", async () => {
    const ctx = context();
    await overlay.onSwipeEnd!(true, ctx);
    expect(ctx.calls).toHaveBeenCalledWith(ctx.prevDecorator, { opacity: 0 }, expect.anything());

    const ctx2 = context();
    await overlay.onSwipeEnd!(false, ctx2);
    expect(ctx2.calls).toHaveBeenCalledWith(ctx2.prevDecorator, { opacity: 1 }, expect.anything());
  });
});
