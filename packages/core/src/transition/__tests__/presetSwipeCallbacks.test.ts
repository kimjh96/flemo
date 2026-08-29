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
    // The VERDICT only: the controller supplies the progress a decorator and
    // a part receive, against the box the screen is dragged over.
    expect(onProgress).toHaveBeenCalledWith(true);
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

  it("mirrors the previous screen from -30% to 0% across the drag", () => {
    const ctx = context();
    const onProgress = vi.fn();

    // No drag yet: previous screen rests at its -30% parallax position.
    cupertino.onSwipe!(pointerEvent, swipeInfo({ offset: { x: 0, y: 0 } }), {
      ...ctx,
      onProgress
    });
    expect(ctx.calls).toHaveBeenCalledWith(ctx.currentScreen, { x: 0 }, { duration: 0 });
    expect(ctx.calls).toHaveBeenCalledWith(ctx.prevScreen, { x: "-30%" }, { duration: 0 });
    expect(onProgress).toHaveBeenCalledWith(true);

    ctx.calls.mockClear();

    // Full-width drag: previous screen reaches identity (0%).
    cupertino.onSwipe!(pointerEvent, swipeInfo({ offset: { x: window.innerWidth, y: 0 } }), {
      ...ctx,
      onProgress
    });
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      { x: window.innerWidth },
      { duration: 0 }
    );
    expect(ctx.calls).toHaveBeenCalledWith(ctx.prevScreen, { x: "0%" }, { duration: 0 });
  });

  it("clamps the current screen so a leftward drag never pulls it off-axis", () => {
    const ctx = context();
    const progress = cupertino.onSwipe!(
      pointerEvent,
      swipeInfo({ offset: { x: -200, y: 0 } }),
      ctx
    );

    expect(ctx.calls).toHaveBeenCalledWith(ctx.currentScreen, { x: 0 }, { duration: 0 });
    expect(progress).toBeLessThan(0);
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
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevScreen,
      expect.objectContaining({ x: 0 }),
      expect.anything()
    );
  });

  it("authors its own span as the release ceiling", () => {
    // The release length itself is the swipe controller's (it knows what is
    // left and how fast the finger was going, for EVERY transition — see
    // swipeSettleSeconds). What the preset owns is the ceiling, and it is this
    // transition's own duration: a release must never outlast the same pop
    // driven by a button, and with the finger nearly still it should match it.
    const ctx = context();
    void cupertino.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 120, y: 0 }, velocity: { x: 0, y: 0 } }),
      { ...ctx, onStart: vi.fn() }
    );

    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.anything(),
      expect.objectContaining({ duration: 0.7 })
    );
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevScreen,
      expect.anything(),
      expect.objectContaining({ duration: 0.7 })
    );
  });

  it("commits at the same fraction of the screen whatever its width", async () => {
    // The threshold shares the progress mapping's reference. 50px was chosen
    // on a 390px phone, so that is what it still means THERE, and a screen of
    // another width asks for the same fraction rather than the same 50px. A
    // gesture that measures its travel one way and decides on it another has
    // two ideas of how far along it is.
    const commitAt = async (screenWidth: number, dragX: number) => {
      const ctx = context();
      ctx.currentScreen.getBoundingClientRect = () =>
        ({ width: screenWidth, height: 700, top: 0, left: 0 }) as DOMRect;
      return cupertino.onSwipeEnd!(pointerEvent, swipeInfo({ offset: { x: dragX, y: 0 } }), {
        ...ctx,
        onStart: vi.fn()
      });
    };

    // A 390px phone still commits either side of 50px, exactly as before.
    await expect(commitAt(390, 51)).resolves.toBe(true);
    await expect(commitAt(390, 49)).resolves.toBe(false);

    // A screen at half that width asks for half the travel...
    await expect(commitAt(195, 26)).resolves.toBe(true);
    await expect(commitAt(195, 24)).resolves.toBe(false);

    // ...and a wide one asks for proportionally more, where a flat 50px was
    // under 4% of the screen and committed almost on contact.
    await expect(commitAt(1275, 100)).resolves.toBe(false);
    await expect(commitAt(1275, 200)).resolves.toBe(true);
  });

  it("cancels back to rest under the threshold", async () => {
    const ctx = context();
    const onStart = vi.fn();
    const triggered = await cupertino.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 4, y: 0 }, velocity: { x: 0, y: 0 } }),
      { ...ctx, onStart }
    );

    expect(triggered).toBe(false);
    expect(onStart).toHaveBeenCalledWith(false);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ x: 0 }),
      expect.anything()
    );
    // The previous screen settles back at its parallax rest position.
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevScreen,
      expect.objectContaining({ x: "-30%" }),
      expect.anything()
    );
  });
});

describe("material swipe", () => {
  it("starts a swipe unconditionally", async () => {
    await expect(material.onSwipeStart!(pointerEvent, swipeInfo(), context())).resolves.toBe(true);
  });

  it("fades the previous screen in (opacity 0 -> 1) as it lifts back to rest", () => {
    const ctx = context();

    // No drag: previous screen sits at -56px, fully transparent.
    material.onSwipe!(pointerEvent, swipeInfo({ offset: { x: 0, y: 0 } }), ctx);
    expect(ctx.calls).toHaveBeenCalledWith(ctx.prevScreen, { y: -56, opacity: 0 }, { duration: 0 });

    ctx.calls.mockClear();

    // Dragged exactly the 56px threshold: previous screen reaches rest + opaque.
    material.onSwipe!(pointerEvent, swipeInfo({ offset: { x: 0, y: 56 } }), ctx);
    expect(ctx.calls).toHaveBeenCalledWith(ctx.currentScreen, { y: 56 }, { duration: 0 });
    expect(ctx.calls).toHaveBeenCalledWith(ctx.prevScreen, { y: 0, opacity: 1 }, { duration: 0 });
  });

  it("applies sqrt resistance past the threshold and caps progress at 56", () => {
    const ctx = context();
    const onProgress = vi.fn();

    // 56 + 160 of extra drag -> extraRatio 1 -> resistedExtra 12 -> finalY 68,
    // but progress (and thus the previous screen) is capped at the 56 rest point.
    const progress = material.onSwipe!(pointerEvent, swipeInfo({ offset: { x: 0, y: 216 } }), {
      ...ctx,
      onProgress
    });

    expect(progress).toBe(56);
    expect(onProgress).toHaveBeenCalledWith(true);
    expect(ctx.calls).toHaveBeenCalledWith(ctx.currentScreen, { y: 68 }, { duration: 0 });
    expect(ctx.calls).toHaveBeenCalledWith(ctx.prevScreen, { y: 0, opacity: 1 }, { duration: 0 });
  });

  it("commits on a long downward drag, sending the current screen off and the previous to rest", async () => {
    const ctx = context();
    const onStart = vi.fn();
    const commit = await material.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 0, y: 200 }, velocity: { x: 0, y: 0 } }),
      { ...ctx, onStart }
    );

    expect(commit).toBe(true);
    expect(onStart).toHaveBeenCalledWith(true);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ y: "100%" }),
      expect.anything()
    );
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevScreen,
      expect.objectContaining({ y: 0, opacity: 1 }),
      expect.anything()
    );
  });

  it("cancels below the threshold, re-hiding the previous screen", async () => {
    const ctx = context();
    const onStart = vi.fn();
    const cancel = await material.onSwipeEnd!(
      pointerEvent,
      swipeInfo({ offset: { x: 0, y: 10 }, velocity: { x: 0, y: 0 } }),
      { ...ctx, onStart }
    );

    expect(cancel).toBe(false);
    expect(onStart).toHaveBeenCalledWith(false);
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ y: 0 }),
      expect.anything()
    );
    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.prevScreen,
      expect.objectContaining({ y: -56, opacity: 0 }),
      expect.anything()
    );
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
    expect(onProgress).toHaveBeenCalledWith(true);
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
