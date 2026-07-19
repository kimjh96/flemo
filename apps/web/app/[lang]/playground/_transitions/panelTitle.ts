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
  enter: { value: { opacity: 0.35, y: -18 }, options: { duration: 0.6, ease: EASE } },
  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } },
  options: {
    // The interactive path: as the swipe reveals the previous screen, its
    // title recovers with the drag progress. The recovery compresses into the
    // drag's first 60% and the travel is 18px: a slow scrub then moves the
    // title ~1px per ~13px of drag, fine enough to read as continuous — a
    // 10px travel over the full width stepped only every ~39px of drag,
    // which a slow swipe presented as discrete hops (the signal itself is a
    // per-frame float; the pixel grid is what quantizes small travels).
    onSwipe: (_, progress, { animate, element, active }) => {
      if (active) return;
      const recovered = Math.min(1, Math.max(0, progress / 60));
      animate(
        element,
        { opacity: 0.35 + 0.65 * recovered, y: -18 * (1 - recovered) },
        { duration: 0 }
      );
    },
    onSwipeEnd: (triggered, { animate, element, active }) => {
      if (active) return;
      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -18 }, {
        duration: 0.3,
        ease: EASE
      });
    }
  }
});

export default panelTitle;
