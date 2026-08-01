import { describe, expect, it, vi } from "vitest";

import cupertino from "@transition/cupertino";
import material from "@transition/material";

import type { SwipeInfo, Transition } from "@transition/typing";

// The swipe handlers are pure value-math: given a drag, they compute the
// target the current/previous screens should sit at and hand it to the
// injected `animate`. We exercise that math directly with a spy `animate`
// and synthetic pointer info, no DOM choreography (that lives in the
// playground e2e), just the parallax/fade numbers we care about.

const makeInfo = (overrides: Partial<SwipeInfo>): SwipeInfo => ({
  point: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
  ...overrides
});

// `Transition` is a union whose no-swipe branch lacks the handlers. Narrow to
// the swipe-capable shape so the handlers are callable without per-call casts.
const swipeable = (transition: Transition) => {
  if (!("onSwipe" in transition) || typeof transition.onSwipe !== "function") {
    throw new Error("transition is expected to define swipe handlers");
  }
  return transition;
};

const cup = swipeable(cupertino);
const mat = swipeable(material);

const makeContext = () => {
  const animate = vi.fn(() => Promise.resolve());
  const onProgress = vi.fn();
  const onStart = vi.fn();
  const currentScreen = document.createElement("div");
  const prevScreen = document.createElement("div");
  return { animate, onProgress, onStart, currentScreen, prevScreen };
};

const event = {} as PointerEvent;

describe("cupertino swipe handlers", () => {
  it("mirrors the previous screen from -30% to 0% across the drag", () => {
    const { animate, onProgress, currentScreen, prevScreen } = makeContext();

    // No drag yet: previous screen rests at its -30% parallax position.
    cup.onSwipe(event, makeInfo({ offset: { x: 0, y: 0 } }), {
      animate,
      currentScreen,
      prevScreen,
      onProgress
    });
    expect(animate).toHaveBeenCalledWith(currentScreen, { x: 0 }, { duration: 0 });
    expect(animate).toHaveBeenCalledWith(prevScreen, { x: "-30%" }, { duration: 0 });
    expect(onProgress).toHaveBeenCalledWith(true, 0);

    animate.mockClear();

    // Full-width drag: previous screen reaches identity (0%).
    cup.onSwipe(event, makeInfo({ offset: { x: window.innerWidth, y: 0 } }), {
      animate,
      currentScreen,
      prevScreen,
      onProgress
    });
    expect(animate).toHaveBeenCalledWith(currentScreen, { x: window.innerWidth }, { duration: 0 });
    expect(animate).toHaveBeenCalledWith(prevScreen, { x: "0%" }, { duration: 0 });
  });

  it("clamps the current screen so a leftward drag never pulls it off-axis", () => {
    const { animate, currentScreen, prevScreen } = makeContext();

    const progress = cup.onSwipe(event, makeInfo({ offset: { x: -200, y: 0 } }), {
      animate,
      currentScreen,
      prevScreen
    });

    expect(animate).toHaveBeenCalledWith(currentScreen, { x: 0 }, { duration: 0 });
    expect(progress).toBeLessThan(0);
  });

  it("commits to the previous screen when the drag passes the threshold", async () => {
    const { animate, onStart, currentScreen, prevScreen } = makeContext();

    const triggered = await cup.onSwipeEnd(event, makeInfo({ offset: { x: 120, y: 0 } }), {
      animate,
      currentScreen,
      prevScreen,
      onStart
    });

    expect(triggered).toBe(true);
    expect(onStart).toHaveBeenCalledWith(true);
    expect(animate).toHaveBeenCalledWith(currentScreen, { x: "100%" }, expect.anything());
    expect(animate).toHaveBeenCalledWith(prevScreen, { x: 0 }, expect.anything());
  });

  it("snaps back when the drag is released below the threshold", async () => {
    const { animate, onStart, currentScreen, prevScreen } = makeContext();

    const triggered = await cup.onSwipeEnd(event, makeInfo({ offset: { x: 10, y: 0 } }), {
      animate,
      currentScreen,
      prevScreen,
      onStart
    });

    expect(triggered).toBe(false);
    expect(onStart).toHaveBeenCalledWith(false);
    expect(animate).toHaveBeenCalledWith(currentScreen, { x: 0 }, expect.anything());
    expect(animate).toHaveBeenCalledWith(prevScreen, { x: "-30%" }, expect.anything());
  });
});

describe("material swipe handlers", () => {
  it("fades the previous screen in (opacity 0 → 1) as it lifts back to rest", () => {
    const { animate, currentScreen, prevScreen } = makeContext();

    // No drag: previous screen sits at -56px, fully transparent.
    mat.onSwipe(event, makeInfo({ offset: { x: 0, y: 0 } }), {
      animate,
      currentScreen,
      prevScreen
    });
    expect(animate).toHaveBeenCalledWith(prevScreen, { y: -56, opacity: 0 }, { duration: 0 });

    animate.mockClear();

    // Dragged exactly the 56px threshold: previous screen reaches rest + opaque.
    mat.onSwipe(event, makeInfo({ offset: { x: 0, y: 56 } }), {
      animate,
      currentScreen,
      prevScreen
    });
    expect(animate).toHaveBeenCalledWith(currentScreen, { y: 56 }, { duration: 0 });
    expect(animate).toHaveBeenCalledWith(prevScreen, { y: 0, opacity: 1 }, { duration: 0 });
  });

  it("applies sqrt resistance past the threshold and caps progress at 56", () => {
    const { animate, currentScreen, prevScreen } = makeContext();

    // 56 + 160 of extra drag → extraRatio 1 → resistedExtra 12 → finalY 68,
    // but progress (and thus the previous screen) is capped at the 56 rest point.
    const progress = mat.onSwipe(event, makeInfo({ offset: { x: 0, y: 216 } }), {
      animate,
      currentScreen,
      prevScreen
    });

    expect(progress).toBe(56);
    expect(animate).toHaveBeenCalledWith(currentScreen, { y: 68 }, { duration: 0 });
    expect(animate).toHaveBeenCalledWith(prevScreen, { y: 0, opacity: 1 }, { duration: 0 });
  });

  it("commits when dragged past the threshold", async () => {
    const { animate, onStart, currentScreen, prevScreen } = makeContext();

    const triggered = await mat.onSwipeEnd(event, makeInfo({ offset: { x: 0, y: 80 } }), {
      animate,
      currentScreen,
      prevScreen,
      onStart
    });

    expect(triggered).toBe(true);
    expect(onStart).toHaveBeenCalledWith(true);
    expect(animate).toHaveBeenCalledWith(currentScreen, { y: "100%" }, expect.anything());
    expect(animate).toHaveBeenCalledWith(prevScreen, { y: 0, opacity: 1 }, expect.anything());
  });

  it("snaps back below the threshold, re-hiding the previous screen", async () => {
    const { animate, onStart, currentScreen, prevScreen } = makeContext();

    const triggered = await mat.onSwipeEnd(event, makeInfo({ offset: { x: 0, y: 20 } }), {
      animate,
      currentScreen,
      prevScreen,
      onStart
    });

    expect(triggered).toBe(false);
    expect(onStart).toHaveBeenCalledWith(false);
    expect(animate).toHaveBeenCalledWith(currentScreen, { y: 0 }, expect.anything());
    expect(animate).toHaveBeenCalledWith(prevScreen, { y: -56, opacity: 0 }, expect.anything());
  });
});
