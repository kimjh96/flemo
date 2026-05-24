import type { InitialTarget } from "@transition/cssTypes";
import {
  type TransitionOptions,
  type Transition,
  type TransitionVariantValue,
  type TransitionName
} from "@transition/typing";

interface CreateTransitionProps {
  name: TransitionName;
  initial: InitialTarget;
  idle: TransitionVariantValue;
  enter: TransitionVariantValue;
  enterBack: TransitionVariantValue;
  exit: TransitionVariantValue;
  exitBack: TransitionVariantValue;
  options?: TransitionOptions;
}

export default function createTransition({
  name,
  initial,
  idle,
  enter,
  enterBack,
  exit,
  exitBack,
  options
}: CreateTransitionProps): Transition {
  return {
    name,
    initial,
    variants: {
      ["IDLE-true"]: idle,
      ["IDLE-false"]: idle,
      ["PUSHING-false"]: exit,
      ["PUSHING-true"]: enter,
      ["REPLACING-false"]: exit,
      ["REPLACING-true"]: enter,
      ["POPPING-false"]: exitBack,
      ["POPPING-true"]: enterBack,
      ["COMPLETED-false"]: exit,
      ["COMPLETED-true"]: enter
    },
    ...options
  };
}
