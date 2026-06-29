"use client";

import { createTransition } from "@flemo/react";

// Springy pop. The entering screen scales up from small with an overshooting
// "back" easing (it springs slightly past 1 before settling), so the arrival
// feels physical. The leaving screen recedes and fades.
const spring = createTransition({
  name: "spring",
  initial: { scale: 0.7, opacity: 0 },
  idle: { value: { scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }
  },
  enterBack: {
    value: { scale: 0.7, opacity: 0 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { scale: 0.96, opacity: 0 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  }
});

export default spring;
