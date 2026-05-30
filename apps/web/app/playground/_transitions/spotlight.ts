"use client";

import { createDecorator, createTransition } from "@flemo/react";

// A transition + decorator combo. The entering screen scales up into focus,
// while a radial-gradient **vignette** decorator darkens the edges of the
// screen going behind — so attention pulls to the center, spotlight-style.
// The decorator is the layer flemo paints over the backgrounding screen; the
// transition references it by `decoratorName`.
const VIGNETTE =
  "radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.6) 100%)";

export const vignette = createDecorator({
  name: "vignette",
  initial: { opacity: 0, background: VIGNETTE },
  idle: {
    value: { opacity: 0, background: VIGNETTE },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, background: VIGNETTE },
    options: { duration: 0.4 }
  },
  exit: {
    value: { opacity: 0, background: VIGNETTE },
    options: { duration: 0.32 }
  }
});

const spotlight = createTransition({
  name: "spotlight",
  initial: { scale: 0.92, opacity: 0 },
  idle: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { scale: 0.92, opacity: 0 },
    options: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { scale: 0.96 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1 },
    options: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  },
  options: { decoratorName: "vignette" }
});

export default spotlight;
