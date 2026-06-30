"use client";

import { createTransition } from "@flemo/react";

const EASE = [0.32, 0.72, 0, 1] as const;

// A cross-zoom: the incoming screen scales up into focus while the outgoing one
// pushes slightly forward and fades. Another custom transition for the panel.
const labZoom = createTransition({
  name: "zoom",
  initial: { scale: 0.92, opacity: 0 },
  idle: { value: { scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { scale: 1, opacity: 1 }, options: { duration: 0.34, ease: EASE } },
  enterBack: { value: { scale: 0.92, opacity: 0 }, options: { duration: 0.28, ease: EASE } },
  exit: { value: { scale: 1.04, opacity: 0 }, options: { duration: 0.34, ease: EASE } },
  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.28, ease: EASE } }
});

export default labZoom;
