"use client";

import { createTransition } from "@flemo/react";

import { SITE_DURATION, SITE_DURATION_BACK, SITE_EASE, SITE_OFFSET } from "./site.constants";

// The lateral move between top-level sections, to a section further right in the header. The incoming section
// slides a short way in while fading up; the outgoing one slides the other way
// while fading down.
const siteForward = createTransition({
  name: "site-forward",
  initial: { x: SITE_OFFSET, opacity: 0 },
  idle: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0, opacity: 1 },
    options: { duration: SITE_DURATION, ease: SITE_EASE }
  },
  enterBack: {
    value: { x: SITE_OFFSET, opacity: 0 },
    options: { duration: SITE_DURATION_BACK, ease: SITE_EASE }
  },
  exit: {
    value: { x: `-${SITE_OFFSET}`, opacity: 0 },
    options: { duration: SITE_DURATION, ease: SITE_EASE }
  },
  exitBack: {
    value: { x: 0, opacity: 1 },
    options: { duration: SITE_DURATION_BACK, ease: SITE_EASE }
  }
});

export default siteForward;
