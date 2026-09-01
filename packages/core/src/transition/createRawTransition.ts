import type { InitialTarget } from "@transition/cssTypes";
import {
  type TransitionOptions,
  type Transition,
  type ScreenVariantValue,
  type TransitionName
} from "@transition/typing";

interface CreateRawTransitionProps {
  name: TransitionName;
  initial: InitialTarget;
  idle: ScreenVariantValue;
  pushOnEnter: ScreenVariantValue;
  pushOnExit: ScreenVariantValue;
  replaceOnEnter: ScreenVariantValue;
  replaceOnExit: ScreenVariantValue;
  popOnEnter: ScreenVariantValue;
  popOnExit: ScreenVariantValue;
  completedOnEnter: ScreenVariantValue;
  completedOnExit: ScreenVariantValue;
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
