"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Transition + decorator combo with a *moving* decorator. As the new screen
// lifts in with a soft cross-fade, a diagonal **sheen** — a bright band — sweeps
// across the screen behind it, like light glancing off glass. The decorator
// animates `backgroundPosition` (not just opacity), so the highlight actually
// travels. The backdrop holds still so the sweep reads clearly.
// A specular glint: a hot, bright core framed by a pair of faint dark
// shoulders, all feathered out to transparent. The dark shoulders give the
// bright core the contrast it needs to read on a light surface (a plain white
// sweep is invisible on white) — like the bright line and shadowed edge of
// light glancing off glass. No blend mode: it must read on light content too.
const SHEEN_BASE = {
  background:
    "linear-gradient(100deg, rgba(0,0,0,0) 28%, rgba(0,0,0,0.05) 41%, rgba(255,255,255,0.9) 50%, rgba(0,0,0,0.05) 59%, rgba(0,0,0,0) 72%)",
  backgroundSize: "300% 300%",
  backgroundRepeat: "no-repeat"
} as const;

export const sheen = createDecorator({
  name: "sheen",
  initial: { ...SHEEN_BASE, opacity: 0, backgroundPosition: "150% 50%" },
  idle: {
    value: { ...SHEEN_BASE, opacity: 0, backgroundPosition: "150% 50%" },
    options: { duration: 0 }
  },
  // Even (near-linear) ease so the light glides across instead of whipping,
  // and the peak opacity stays low so it's a sheen, not a stripe.
  enter: {
    value: { ...SHEEN_BASE, opacity: 1, backgroundPosition: "-50% 50%" },
    options: { duration: 0.62, ease: [0.4, 0, 0.6, 1] }
  },
  exit: {
    value: { ...SHEEN_BASE, opacity: 0, backgroundPosition: "-50% 50%" },
    options: { duration: 0.4 }
  }
});

const shine = createTransition({
  name: "shine",
  initial: { y: 24, opacity: 0 },
  idle: {
    value: { y: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0, opacity: 1 },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { y: 24, opacity: 0 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.55 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.4 }
  },
  options: { decoratorName: "sheen" }
});

export default shine;
