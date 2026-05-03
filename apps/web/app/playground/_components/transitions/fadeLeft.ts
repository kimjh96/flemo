import { createTransition } from "flemo";

const ease = [0.32, 0.72, 0, 1] as const;
const duration = 0.26;

/** Incoming screen slides in from the left while the current screen slides out to the right. */
const fadeLeft = createTransition({
  name: "fadeLeft",
  initial: { x: "-3%", opacity: 0 },
  idle: { value: { x: 0, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { x: 0, opacity: 1 }, options: { duration, ease } },
  enterBack: { value: { x: "-3%", opacity: 0 }, options: { duration, ease } },
  exit: { value: { x: "3%", opacity: 0 }, options: { duration, ease } },
  exitBack: { value: { x: 0, opacity: 1 }, options: { duration, ease } }
});

export default fadeLeft;
