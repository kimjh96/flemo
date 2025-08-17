import {
  type TransitionOptions,
  type Transition,
  type TransitionVariantValue,
  type TransitionName
} from "@transition/typing";

import type { TargetAndTransition } from "motion";

interface CreateRawTransitionProps {
  name: TransitionName;
  initial: TargetAndTransition;
  idle: TransitionVariantValue;
  pushOnEnter: TransitionVariantValue;
  pushOnExit: TransitionVariantValue;
  replaceOnEnter: TransitionVariantValue;
  replaceOnExit: TransitionVariantValue;
  popOnEnter: TransitionVariantValue;
  popOnExit: TransitionVariantValue;
  completedOnEnter: TransitionVariantValue;
  completedOnExit: TransitionVariantValue;
  options?: TransitionOptions;
}

export default function createRawTransition({
  name,
  initial,
  idle,
  pushOnEnter,
  pushOnExit,
  replaceOnEnter,
  replaceOnExit,
  popOnEnter,
  popOnExit,
  completedOnExit,
  completedOnEnter,
  options
}: CreateRawTransitionProps): Transition {
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
