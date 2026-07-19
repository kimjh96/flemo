"use client";

import { createPartTransition } from "@flemo/react";

const EASE = [0.32, 0.72, 0, 1] as const;

// A selective per-element motion (<Part name="panel-title">): the panel title
// drifts up and dims as its screen recedes into the background, and settles
// back on return — riding the screen's lifecycle on the player's clock, and
// the drag progress during a swipe.
const panelTitle = createPartTransition({
  name: "panel-title",
  initial: { opacity: 1, y: 0 },
  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },
  enter: { value: { opacity: 0.35, y: -24 }, options: { duration: 0.6, ease: EASE } },
  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } },
  options: {
    // The interactive path: as the swipe reveals the previous screen, its
    // title recovers with the drag progress. Two things make a slow scrub
    // read as continuous:
    // - The compositor layer promotion below (onSwipeStart): a fractional
    //   translate on an own layer renders sub-pixel (texture-filtered)
    //   instead of snapping to the pixel grid — the difference between a
    //   stepping title and a gliding one. The swipe teardown strips the
    //   inline hint, so the title rasterizes crisp again at rest.
    // - Density: 24px of travel compressed into the drag's first 50% moves
    //   the title ~1px per ~10px of drag (the original 10px-over-full-width
    //   choreography stepped once per ~39px, presenting as discrete hops
    //   even though the signal itself is a per-frame float).
    onSwipeStart: (_, { animate, element, active }) => {
      if (active) return;
      animate(element, { willChange: "transform, opacity" }, { duration: 0 });
    },
    onSwipe: (_, progress, { animate, element, active }) => {
      if (active) return;
      const recovered = Math.min(1, Math.max(0, progress / 50));
      animate(
        element,
        { opacity: 0.35 + 0.65 * recovered, y: -24 * (1 - recovered) },
        { duration: 0 }
      );
    },
    onSwipeEnd: (triggered, { animate, element, active }) => {
      if (active) return;
      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -24 }, {
        duration: 0.3,
        ease: EASE
      });
    }
  }
});

export default panelTitle;
