import { createTransition } from "@flemo/react";

/**
 * Custom transition example — a soft cross-fade.
 * Used by /login → / replace to demonstrate `createTransition` + `defaultTransitionName`
 * override at the navigate site.
 */
const fade = createTransition({
  name: "fade",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: { duration: 0.35, ease: [0.32, 0.72, 0, 1] } },
  enterBack: { value: { opacity: 0 }, options: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } },
  exit: { value: { opacity: 0 }, options: { duration: 0.35, ease: [0.32, 0.72, 0, 1] } },
  exitBack: { value: { opacity: 1 }, options: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }
});

export default fade;
