"use client";

import { createPartTransition } from "@flemo/react";

const EASE = [0.32, 0.72, 0, 1] as const;

// A selective per-element motion (<Part name="stress-entry">): the stress-lab
// entry button inside the control dock sinks a little and dims as the panels
// screen recedes behind the stress lab, and settles back on return — riding
// that screen's lifecycle on the player's clock, and the drag progress during a
// swipe. The dock is the nested panels Router's chrome, so the Part binds to
// the OUTER panels screen: panel moves inside the nested Router never fire it.
const stressEntry = createPartTransition({
  name: "stress-entry",
  initial: { opacity: 1, y: 0 },
  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },
  enter: { value: { opacity: 0.35, y: 8 }, options: { duration: 0.6, ease: EASE } },
  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } },
  options: {
    // The interactive path: as the swipe reveals the previous panel, its entry
    // row recovers with the drag progress (0-100) and settles the rest on
    // release. The active side rides its screen untouched.
    onSwipe: (_, progress, { animate, element, active }) => {
      if (active) return;
      const recovered = Math.min(1, Math.max(0, progress / 100));
      animate(
        element,
        { opacity: 0.35 + 0.65 * recovered, y: 8 * (1 - recovered) },
        { duration: 0 }
      );
    },
    onSwipeEnd: (triggered, { animate, element, active }) => {
      if (active) return;
      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: 8 }, {
        duration: 0.3,
        ease: EASE
      });
    }
  }
});

export default stressEntry;
