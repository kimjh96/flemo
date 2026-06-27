"use client";

import { createBarTransition } from "@flemo/react";

// A bar-child transition: the wrapped element fades + lifts in as its screen
// becomes active, and fades + lifts out as the screen drops into the
// background. Reference it from <BarTransition name="title-fade">. Programmatic
// transitions run the compiled keyframes on the compositor (no React re-render);
// the same definition drives the swipe drag inline.
const titleFade = createBarTransition({
  name: "title-fade",
  initial: { opacity: 0, transform: "translateY(8px)" },
  idle: {
    value: { opacity: 1, transform: "translateY(0px)" },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  enter: {
    value: { opacity: 0, transform: "translateY(-8px)" },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { opacity: 1, transform: "translateY(0px)" },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  options: {
    // Interactive swipe-back: the leaving (active) screen's title fades + lifts
    // out in lockstep with the finger; reverses if the drag reverses. Inline
    // writes, no React re-render.
    onSwipe: (_, progress, { animate, element, active }) => {
      if (!active) return;
      const p = Math.max(0, Math.min(1, progress / 100));
      animate(element, { opacity: 1 - p, transform: `translateY(${-8 * p}px)` }, { duration: 0 });
    }
  }
});

export default titleFade;
