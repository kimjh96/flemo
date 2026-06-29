"use client";

import { createTransition } from "@flemo/react";

import { SLIDE_DURATION, SLIDE_DURATION_BACK, SLIDE_EASE } from "./slide.constants";

// Docs enters with a full-width horizontal shove (the horizontal mirror of the
// playground's page-shove): the docs page slides all the way in from the right
// while the marketing surface is pushed all the way out to the left, the two
// moving together so one page visibly shoves the other off-screen, not a cover.
const docsEnter = createTransition({
  name: "docs-enter",
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: SLIDE_DURATION, ease: SLIDE_EASE } },
  enterBack: { value: { x: "100%" }, options: { duration: SLIDE_DURATION_BACK, ease: SLIDE_EASE } },
  exit: { value: { x: "-100%" }, options: { duration: SLIDE_DURATION, ease: SLIDE_EASE } },
  exitBack: { value: { x: 0 }, options: { duration: SLIDE_DURATION_BACK, ease: SLIDE_EASE } }
});

export default docsEnter;
