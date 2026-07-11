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
  enter: { value: { opacity: 0.35, y: -10 }, options: { duration: 0.6, ease: EASE } },
  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } }
});

export default panelTitle;
