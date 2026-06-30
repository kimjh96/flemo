"use client";

import { createTransition } from "@flemo/react";

const EASE = [0.4, 0, 0.2, 1] as const;

// A plain cross-fade, authored with createTransition, one of the custom
// transitions selectable in the playground control panel.
const labFade = createTransition({
  name: "fade",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: { duration: 0.3, ease: EASE } },
  enterBack: { value: { opacity: 0 }, options: { duration: 0.26, ease: EASE } },
  exit: { value: { opacity: 0 }, options: { duration: 0.3, ease: EASE } },
  exitBack: { value: { opacity: 1 }, options: { duration: 0.26, ease: EASE } }
});

export default labFade;
