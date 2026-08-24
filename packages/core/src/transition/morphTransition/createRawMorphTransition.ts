import type { InitialTarget } from "@transition/cssTypes";
import type { TransitionVariantValue } from "@transition/typing";

import type {
  MorphTransition,
  MorphTransitionName,
  MorphTransitionOptions
} from "@transition/morphTransition/typing";

interface CreateRawMorphProps {
  name: MorphTransitionName;
  initial: InitialTarget;
  idle: TransitionVariantValue;
  pushOnEnter: TransitionVariantValue;
  pushOnExit: TransitionVariantValue;
  replaceOnEnter: TransitionVariantValue;
  replaceOnExit: TransitionVariantValue;
  popOnEnter: TransitionVariantValue;
  popOnExit: TransitionVariantValue;
  options?: MorphTransitionOptions;
}

// Full-control factory: every status gets its own pair of sides, for when the
// enter / exit collapse in createMorphTransition is too coarse — a pop that
// should trade places faster than the push did, say. Mirrors
// createRawPartTransition.
//
// The rest variants (IDLE / COMPLETED) are not authorable per status: a morph
// only exists as a pair mid-flight, and both sides are back to plain layout by
// the time either status is reached.
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
