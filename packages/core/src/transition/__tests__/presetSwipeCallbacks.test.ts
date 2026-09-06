import { describe, expect, it, vi } from "vitest";

import cupertinoPreset from "@transition/cupertino";
import layoutPreset from "@transition/layout";
import materialPreset from "@transition/material";

import {
  DEFAULT_COMMIT_FRACTION,
  DEFAULT_COMMIT_VELOCITY,
  resolveSwipeOptions
} from "@transition/resolveSwipeOptions";
import type { SwipeAnimate, SwipeInfo, Transition } from "@transition/typing";

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

const cupertino = cupertinoPreset as unknown as Transition;
const material = materialPreset as unknown as Transition;
const layout = layoutPreset as unknown as Transition;

/** The swipe a preset declares, resolved the way the controller reads it. */
const swipeOf = (transition: Transition) => resolveSwipeOptions(transition)!;

describe("cupertino's declared swipe", () => {
  // A DIRECTION IS THE WHOLE DECLARATION. cupertino used to write sixty lines
  // of hooks that between them walked its own pop at the finger, which is what
  // the controller now does from the keyframes. What is pinned here is that it
  // asks for nothing else: the defaults ARE the numbers it used to carry.
  const swipe = swipeOf(cupertino);

  it("declares an axis and nothing else", () => {
    expect(swipe.direction).toBe("x");
    expect(swipe.onStart).toBeUndefined();
    expect(swipe.onMove).toBeUndefined();
    expect(swipe.onEnd).toBeUndefined();
  });

  it("leaves the screens to the controller, so the drag is an animation", () => {
    expect(swipe.drivesScreens).toBe(true);
  });

  it("commits at the fraction of the screen it always did, whatever the width", () => {
    // 50px on the 390px screen the number was chosen on, so a phone commits
    // exactly where it did and a wider screen asks proportionally more.
    expect(swipe.commitDistance(390)).toBeCloseTo(50, 5);
    expect(swipe.commitDistance(780)).toBeCloseTo(100, 5);
    expect(DEFAULT_COMMIT_FRACTION * 390).toBeCloseTo(50, 5);
  });

  it("walks both sides together, one for one with the finger", () => {
    const at = (travelled: number) => swipe.progress(swipeInfo(), 400, travelled);
    expect(at(0)).toEqual({ active: 0, passive: 0 });
    expect(at(200)).toEqual({ active: 0.5, passive: 0.5 });
    // Past its own width the screen is home; a finger that keeps going does
    // not send it further.
    expect(at(600)).toEqual({ active: 1, passive: 1 });
  });
});

describe("material's declared swipe", () => {
  // The RATE is material's and the SHAPE is its keyframes'. What this pins is
  // the rubber band, which is the only thing the move to a declaration could
  // have quietly lost.
  const swipe = swipeOf(material);
  const at = (dragY: number, span = 800) =>
    swipe.progress(swipeInfo({ offset: { x: 0, y: dragY } }), span, dragY);

  it("declares its own threshold, the pull it is built around", () => {
    expect(swipe.direction).toBe("y");
    expect(swipe.commitDistance(800)).toBe(56);
    expect(swipe.drivesScreens).toBe(true);
  });

  it("follows the finger one for one up to the pull", () => {
    // The screen arriving underneath travels 56px and is then home.
    expect(at(0).passive).toBeCloseTo(0, 5);
    expect(at(28).passive).toBeCloseTo(0.5, 5);
    expect(at(56).passive).toBeCloseTo(1, 5);
    // The screen leaving travels its own height, so the same 28px is a much
    // smaller share of its trip.
    expect(at(28).active).toBeCloseTo(28 / 800, 5);
  });

  it("resists past the pull instead of following on, and the arriving side waits", () => {
    // A finger 160px past the pull has dragged the band its full 12px further.
    expect(at(56 + 160).active).toBeCloseTo((56 + 12) / 800, 5);
    // Half of that overshoot is a SQUARE ROOT of the way, not half.
    expect(at(56 + 80).active).toBeCloseTo((56 + Math.SQRT1_2 * 12) / 800, 5);
    // ...and none of it moves the screen that has already arrived.
    expect(at(56 + 160).passive).toBeCloseTo(1, 5);
  });

  it("never travels upward, however far back the finger goes", () => {
    expect(at(-200)).toEqual({ active: 0, passive: 0 });
  });

  it("reads a screen with no height yet as untravelled", () => {
    // A sheet dragged before its box has been laid out: the leaving side's
    // share of a zero-height trip is not a number, and it would be scrubbed
    // into the animation as one. The arriving side is measured against the
    // pull rather than the box, so it still reads.
    expect(at(28, 0)).toEqual({ active: 0, passive: 0.5 });
  });
});

describe("a transition that declares no swipe", () => {
  it("has no gesture, with nothing to turn off", () => {
    expect(resolveSwipeOptions({} as unknown as Transition)).toBeNull();
  });
});

describe("the presets' shared numbers", () => {
  it("all take the same default commit speed, and none overrides it", () => {
    // The 20 each of them used to write for itself. It is a default rather
    // than a law: a consumer transition asks for 300, and a declarative drag
    // needs somewhere to say so.
    for (const preset of [cupertinoPreset, materialPreset, layoutPreset]) {
      expect(swipeOf(preset as unknown as Transition).commitVelocity).toBe(DEFAULT_COMMIT_VELOCITY);
    }
  });
});

describe("layout's own swipe, which keeps its hooks", () => {
  // The case that shows the hooks are not vestigial: layout's pop is a pure
  // fade, and its DRAG pulls the screen down. The shape differs, not just the
  // rate, so no progress mapping expresses it and layout drives its screens.
  it("keeps the screens, because it took the drag over", () => {
    expect(swipeOf(layout).drivesScreens).toBe(false);
  });

  it("starts a swipe unconditionally", async () => {
    await expect(swipeOf(layout).onStart!(pointerEvent, swipeInfo(), context())).resolves.toBe(
      true
    );
  });

  it("fades and offsets the screen with resistance on drag", () => {
    const ctx = context();
    const onProgress = vi.fn();
    const progress = swipeOf(layout).onMove!(pointerEvent, swipeInfo({ offset: { x: 0, y: 40 } }), {
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
    swipeOf(layout).onMove!(pointerEvent, swipeInfo({ offset: { x: 0, y: -30 } }), ctx);

    expect(ctx.calls).toHaveBeenCalledWith(
      ctx.currentScreen,
      expect.objectContaining({ y: 0 }),
      expect.anything()
    );
  });

  it("commits past the drag threshold and restores under it", async () => {
    const commitCtx = context();
    const onStart = vi.fn();
    const commit = await swipeOf(layout).onEnd!(
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

    const cancel = await swipeOf(layout).onEnd!(
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
