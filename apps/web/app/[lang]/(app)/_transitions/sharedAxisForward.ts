"use client";

import { createTransition } from "@flemo/react";

import { SHARED_AXIS_EASE, SHARED_AXIS_OFFSET } from "./sharedAxis.constants";

// Material shared-axis (X), forward direction. The incoming peer slides in from
// a short offset to the right while fading up; the outgoing peer slides off a
// short offset to the left while fading down. Used for moving to a higher-index
// top-level destination (Home → Showcase). These are peers, not parent/child:
// a short offset + fade, never a full-width push, and no swipe-back — so the
// move reads as lateral, not as drilling deeper.
const sharedAxisForward = createTransition({
  name: "shared-axis-forward",
  initial: { x: SHARED_AXIS_OFFSET, opacity: 0 },
  idle: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0.3, ease: SHARED_AXIS_EASE }
  },
  enterBack: {
    value: { x: SHARED_AXIS_OFFSET, opacity: 0 },
    options: { duration: 0.26, ease: SHARED_AXIS_EASE }
  },
  exit: {
    value: { x: `-${SHARED_AXIS_OFFSET}`, opacity: 0 },
    options: { duration: 0.3, ease: SHARED_AXIS_EASE }
  },
  exitBack: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0.26, ease: SHARED_AXIS_EASE }
  }
});

export default sharedAxisForward;
