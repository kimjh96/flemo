"use client";

import { createTransition } from "@flemo/react";

import { DRILL_DURATION, DRILL_DURATION_BACK, DRILL_EASE } from "./drill.constants";

// Going deeper on a wide screen: the new page slides all the way in from the
// right while the page it leaves is pushed all the way out to the left. Not a
// cover, so neither page reads as sitting above the other.
const siteDrill = createTransition({
  name: "site-drill",
  initial: { x: "100%" },
  idle: {
    value: { x: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0 },
    options: { duration: DRILL_DURATION, ease: DRILL_EASE }
  },
  enterBack: {
    value: { x: "100%" },
    options: { duration: DRILL_DURATION_BACK, ease: DRILL_EASE }
  },
  exit: {
    value: { x: "-100%" },
    options: { duration: DRILL_DURATION, ease: DRILL_EASE }
  },
  exitBack: {
    value: { x: 0 },
    options: { duration: DRILL_DURATION_BACK, ease: DRILL_EASE }
  }
});

export default siteDrill;
