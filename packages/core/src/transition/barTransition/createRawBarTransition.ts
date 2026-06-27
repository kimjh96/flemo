import type { InitialTarget } from "@transition/cssTypes";
import { type TransitionVariantValue } from "@transition/typing";

import {
  type BarTransition,
  type BarTransitionName,
  type BarTransitionOptions
} from "@transition/barTransition/typing";

interface CreateRawBarTransitionProps {
  name: BarTransitionName;
  initial: InitialTarget;
  idle: TransitionVariantValue;
  pushOnEnter: TransitionVariantValue;
  pushOnExit: TransitionVariantValue;
  replaceOnEnter: TransitionVariantValue;
  replaceOnExit: TransitionVariantValue;
  popOnEnter: TransitionVariantValue;
  popOnExit: TransitionVariantValue;
  completedOnEnter: TransitionVariantValue;
  completedOnExit: TransitionVariantValue;
  options?: BarTransitionOptions;
}

// Full-control factory: every status×active variant is set explicitly, for when
// the idle / enter / exit collapse in createBarTransition is too coarse. Mirrors
// createRawDecorator.
export default function createRawBarTransition({
  name,
  initial,
  idle,
  pushOnEnter,
  pushOnExit,
  replaceOnEnter,
  replaceOnExit,
  popOnEnter,
  popOnExit,
  completedOnEnter,
  completedOnExit,
  options
}: CreateRawBarTransitionProps): BarTransition {
  return {
    name,
    initial,
    variants: {
      ["IDLE-true"]: idle,
      ["IDLE-false"]: idle,
      ["PUSHING-false"]: pushOnExit,
      ["PUSHING-true"]: pushOnEnter,
      ["REPLACING-false"]: replaceOnExit,
      ["REPLACING-true"]: replaceOnEnter,
      ["POPPING-false"]: popOnExit,
      ["POPPING-true"]: popOnEnter,
      ["COMPLETED-false"]: completedOnExit,
      ["COMPLETED-true"]: completedOnEnter
    },
    ...options
  };
}
