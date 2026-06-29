"use client";

import { createTransition } from "@flemo/react";

const EASE = [0.33, 1, 0.68, 1] as const;

// Moving down the docs list: the page rises in from just below while the old one
// lifts up and fades. A short vertical offset, not a full slide.
const docStepForward = createTransition({
  name: "doc-step-forward",
  initial: { y: "34px", opacity: 0 },
  idle: { value: { y: 0, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { y: 0, opacity: 1 }, options: { duration: 0.34, ease: EASE } },
  enterBack: { value: { y: "34px", opacity: 0 }, options: { duration: 0.3, ease: EASE } },
  exit: { value: { y: "-34px", opacity: 0 }, options: { duration: 0.34, ease: EASE } },
  exitBack: { value: { y: 0, opacity: 1 }, options: { duration: 0.3, ease: EASE } }
});

export default docStepForward;
