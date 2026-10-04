import type { InitialTarget } from "@transition/cssTypes";
import type { TransitionVariantValue } from "@transition/typing";

import type {
  MorphTransition,
  MorphTransitionName,
  MorphTransitionOptions
} from "@transition/morphTransition/typing";

interface CreateRawMorphProps {
  /** Public name registered on a Router and selected by a `Morph`. */
  name: MorphTransitionName;
  /** Additional starting style for each element on the new screen, over the measured box of the element on the old screen. */
  initial: InitialTarget;
  /**
   * Resting style, and the style of each element on the old screen before it
   * disappears. It also
   * fills `IDLE-true`, `IDLE-false`, `COMPLETED-true` and `COMPLETED-false`,
   * because a pair exists only during a transition.
   */
  idle: TransitionVariantValue;
  /**
   * Target for `PUSHING-true`, the element on the new screen that moves during
   * a push. A nested Morph grows with its container's transition timing rather
   * than an authored duration.
   */
  pushOnEnter: TransitionVariantValue;
  /** End style for `PUSHING-false`, applied at once to the element on the old screen on a push. */
  pushOnExit: TransitionVariantValue;
  /** Target for `REPLACING-true`, the element on the new screen that moves on a replace. */
  replaceOnEnter: TransitionVariantValue;
  /** End style for `REPLACING-false`, applied at once to the element on the old screen on a replace. */
  replaceOnExit: TransitionVariantValue;
  /**
   * Target for `POPPING-false`, the returning element that moves on a pop. Note
   * the flag: a morph's entering side is the element that MOVES, and on a pop
   * that element sits on the inactive screen being returned to.
   */
  popOnEnter: TransitionVariantValue;
  /** End style for `POPPING-true`, applied at once to the element on the closing top screen on a pop. */
  popOnExit: TransitionVariantValue;
  /** Geometry, cross-fade, radius, and whole-screen (`carry`) behavior for each pair. */
  options?: MorphTransitionOptions;
}

/**
 * Creates shared-element motion with separate targets for the element on the
 * new screen and the element on the old screen, for push, replace, and pop. Rest variants stay `idle` because the pair exists
 * only during a transition.
 */
export default function createRawMorphTransition({
  name,
  initial,
  idle,
  pushOnEnter,
  pushOnExit,
  replaceOnEnter,
  replaceOnExit,
  popOnEnter,
  popOnExit,
  options
}: CreateRawMorphProps): MorphTransition {
  return {
    name,
    initial,
    variants: {
      ["IDLE-true"]: idle,
      ["IDLE-false"]: idle,
      ["PUSHING-true"]: pushOnEnter,
      ["PUSHING-false"]: pushOnExit,
      ["REPLACING-true"]: replaceOnEnter,
      ["REPLACING-false"]: replaceOnExit,
      // Reversed on POP: the dismissing screen keeps the active flag ("-true")
      // until it lands, so the arrival is the "-false" side.
      ["POPPING-true"]: popOnExit,
      ["POPPING-false"]: popOnEnter,
      ["COMPLETED-true"]: idle,
      ["COMPLETED-false"]: idle
    },
    ...options
  };
}
