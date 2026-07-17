"use client";

import { createTransition } from "@flemo/react";

// A tab-bar cross-fade, mirroring plen's `tabForward`: a 150ms opacity
// cross-fade with a 1% horizontal drift, the "replace-like" motion used between
// peer tabs. Perception fixture: the heavy-screen reproduction enters with this
// so the disease is measured against a short, mostly-opacity transition (the
// window a main-thread block most easily swallows whole).
const EASE = [0.4, 0, 0.2, 1] as const;

const tabForward = createTransition({
  name: "tab-forward",
  initial: { opacity: 0, x: "1%" },
  idle: { value: { opacity: 1, x: 0 }, options: { duration: 0 } },
  enter: { value: { opacity: 1, x: 0 }, options: { duration: 0.15, ease: EASE } },
  enterBack: { value: { opacity: 0, x: "1%" }, options: { duration: 0.15, ease: EASE } },
  exit: { value: { opacity: 0, x: "-1%" }, options: { duration: 0.15, ease: EASE } },
  exitBack: { value: { opacity: 1, x: 0 }, options: { duration: 0.15, ease: EASE } }
});

export default tabForward;
