"use client";

import { createTransition } from "@flemo/react";

const EASE = [0.65, 0, 0.35, 1] as const;

// An edge wipe: the entering screen is revealed left-to-right by an inset
// clip. The two clip-path endpoints deliberately use DIFFERENT templates
// (four components vs the one-value shorthand) — a value pair only the
// browser's own interpolation can pair, exercising flemo's scrubbed
// Web-Animation tier. The screen underneath recedes slightly.
const wipe = createTransition({
  name: "wipe",
  initial: { clipPath: "inset(0 0 0 100%)" },
  idle: { value: { clipPath: "inset(0)", scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { clipPath: "inset(0)" }, options: { duration: 0.45, ease: EASE } },
  enterBack: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.38, ease: EASE } },
  exit: { value: { scale: 0.96, opacity: 0.8 }, options: { duration: 0.45, ease: EASE } },
  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.38, ease: EASE } }
});

export default wipe;
