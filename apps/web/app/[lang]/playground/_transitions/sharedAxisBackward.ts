"use client";

import { createTransition } from "@flemo/react";

import { SHARED_AXIS_EASE, SHARED_AXIS_OFFSET } from "./sharedAxis.constants";

// Material shared-axis (X), backward direction, the mirror of
// `sharedAxisForward`. The incoming peer slides in from a short offset to the
// left while fading up; the outgoing peer slides off to the right while fading
// down. Used for moving to a lower-index top-level destination (Showcase →
// Home). The header picks forward vs backward from the nav order, so the
// lateral slide always matches the direction the eye expects.
const sharedAxisBackward = createTransition({
  name: "shared-axis-backward",
  initial: { x: `-${SHARED_AXIS_OFFSET}`, opacity: 0 },
  idle: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0.3, ease: SHARED_AXIS_EASE }
  },
  enterBack: {
    value: { x: `-${SHARED_AXIS_OFFSET}`, opacity: 0 },
    options: { duration: 0.26, ease: SHARED_AXIS_EASE }
  },
  exit: {
    value: { x: SHARED_AXIS_OFFSET, opacity: 0 },
    options: { duration: 0.3, ease: SHARED_AXIS_EASE }
  },
  exitBack: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0.26, ease: SHARED_AXIS_EASE }
  }
});

export default sharedAxisBackward;
