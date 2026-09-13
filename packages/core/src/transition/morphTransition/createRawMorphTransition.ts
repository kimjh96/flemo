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
  /** Additional from-pose for each arriving element over the measured departure box. */
  initial: InitialTarget;
  /**
   * Resting pose and each departing element's pose before its cut. It also
   * fills `IDLE-true`, `IDLE-false`, `COMPLETED-true` and `COMPLETED-false`,
   * because a pair exists only during a flight.
   */
  idle: TransitionVariantValue;
  /**
   * Target for `PUSHING-true`, the arriving element that flies during a push. A
   * nested Morph grows on its container's flight clock rather than an authored
   * duration.
   */
  pushOnEnter: TransitionVariantValue;
  /** End-pose for `PUSHING-false`, cutting the departing element on a push. */
  pushOnExit: TransitionVariantValue;
  /** Target for `REPLACING-true`, the arriving element that flies on a replace. */
  replaceOnEnter: TransitionVariantValue;
  /** End-pose for `REPLACING-false`, cutting the departing element on a replace. */
  replaceOnExit: TransitionVariantValue;
  /**
   * Target for `POPPING-false`, the returning element that flies on a pop. Note
   * the flag: a morph's entering side is the element that FLIES, and on a pop
   * that element sits on the inactive screen being returned to.
   */
  popOnEnter: TransitionVariantValue;
  /** End-pose for `POPPING-true`, cutting the dismissed top element on a pop. */
  popOnExit: TransitionVariantValue;
  /** Geometry, cross-fade, radius, and screen-carrying behavior for each pair. */
  options?: MorphTransitionOptions;
}

/**
 * Creates shared-element motion with separate arriving and departing targets
 * for push, replace, and pop. Rest variants stay `idle` because the pair exists
 * only during a flight.
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
