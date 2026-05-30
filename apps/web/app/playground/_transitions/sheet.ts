"use client";

import { createDecorator, createTransition } from "@flemo/react";

// A transition + decorator combo. The entering screen rises from the bottom
// like a sheet, while a **frost** decorator washes a soft light haze over the
// screen behind it — as if the backdrop frosts over while the sheet comes up.
// The backgrounding screen itself stays put (the transition's `exit` is a
// no-op); the frost layer is what reads.
const FROST = "rgba(247, 248, 250, 0.6)";

export const frost = createDecorator({
  name: "frost",
  initial: { opacity: 0, backgroundColor: FROST },
  idle: {
    value: { opacity: 0, backgroundColor: FROST },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1, backgroundColor: FROST },
    options: { duration: 0.42 }
  },
  exit: {
    value: { opacity: 0, backgroundColor: FROST },
    options: { duration: 0.34 }
  }
});

const sheet = createTransition({
  name: "sheet",
  initial: { y: "100%" },
  idle: {
    value: { y: 0 },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0 },
    options: { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { y: "100%" },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: {},
    options: { duration: 0.42 }
  },
  exitBack: {
    value: {},
    options: { duration: 0.34 }
  },
  options: { decoratorName: "frost" }
});

export default sheet;
