"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo. The new screen grows from a small centered
// card (scale 0.7 → 1) into focus, while a radial **vignette** decorator
// darkens the edges of the screen behind it — the backdrop stays put and full,
// so the vignette reads clearly around the growing card, like a spotlight
// pulling focus to the new content. The transition links the decorator by
// `decoratorName`; flemo paints the decorator over the backgrounding screen.
const VIGNETTE =
  "radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.72) 100%)";

export const vignette = createDecorator({
  name: "vignette",
  initial: { opacity: 0, background: VIGNETTE },
  idle: {
    value: { opacity: 0, background: VIGNETTE },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, background: VIGNETTE },
    options: { duration: 0.45 }
  },
  exit: {
    value: { opacity: 0, background: VIGNETTE },
    options: { duration: 0.35 }
  }
});

const spotlight = createTransition({
  name: "spotlight",
  initial: { scale: 0.7, opacity: 0 },
  idle: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { scale: 0.7, opacity: 0 },
    options: { duration: 0.35, ease: [0.32, 0.72, 0, 1] }
  },
  // The backdrop holds still and full so the vignette is the visible effect.
  exit: {
    value: {},
    options: { duration: 0.45 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.35 }
  },
  options: { decoratorName: "vignette" }
});

export default spotlight;
