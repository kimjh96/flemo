"use client";

import { createTransition } from "@flemo/react";

import { DRIFT_APPROACH, DRIFT_BACK, DRIFT_EASE, DRIFT_IN, DRIFT_RECEDE } from "./drift.constants";

import "./drift.types";

// Depth instead of direction. The arriving screen comes forward from just
// behind the glass while the covered one retreats, and nothing travels
// sideways, so on this bench the artwork's own crossing is the only lateral
// motion in the frame.
//
// ONE SIDE FADES, which is the rule `layout` arrived at the hard way:
//
//   layout.ts
//     "A true cross-fade (both sides animating) was worse: two opaque screens
//      at half opacity double-expose, and the muddle reads as flicker exactly
//      where a shared element is meant to be carrying the eye."
//
// So the arriving screen owns the opacity channel and the covered screen never
// touches it. The covered screen changes scale alone, and its depth cue is
// finished by the `recess` decorator, which this transition names and which
// therefore runs on these same two durations without restating either.
const drift = createTransition({
  name: "drift",
  initial: { opacity: 0, scale: DRIFT_APPROACH },
  idle: {
    value: { opacity: 1, scale: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, scale: 1 },
    options: { duration: DRIFT_IN, ease: DRIFT_EASE }
  },
  enterBack: {
    value: { opacity: 0, scale: DRIFT_APPROACH },
    options: { duration: DRIFT_BACK, ease: DRIFT_EASE }
  },
  // No opacity here, and that is the point: the covered screen stays fully
  // opaque and only recedes.
  exit: {
    value: { scale: DRIFT_RECEDE },
    options: { duration: DRIFT_IN, ease: DRIFT_EASE }
  },
  exitBack: {
    value: { scale: 1 },
    options: { duration: DRIFT_BACK, ease: DRIFT_EASE }
  },
  options: {
    decoratorName: "recess"
  }
});

export default drift;
