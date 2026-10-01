import type { InitialTarget } from "@transition/cssTypes";
import {
  type TransitionOptions,
  type Transition,
  type TransitionVariantValue,
  type TransitionName
} from "@transition/typing";

interface CreateTransitionProps {
  /** Public name registered on a Router and selected by Route or navigation options. */
  name: TransitionName;
  /** Pose held before an arriving screen starts its first transition. */
  initial: InitialTarget;
  /** Resting pose for either side while the Router is idle. */
  idle: TransitionVariantValue;
  /** Target for the arriving, active screen on push or replace. */
  enter: TransitionVariantValue;
  /** Target for the still-active top screen being dismissed on pop. */
  enterBack: TransitionVariantValue;
  /** Target for the covered screen moving into the background on push or replace. */
  exit: TransitionVariantValue;
  /** Target for the inactive screen returning from underneath on pop. */
  exitBack: TransitionVariantValue;
  /** Gesture, decorator, and runtime behavior shared by the generated variants. */
  options?: TransitionOptions;
}

/**
 * Creates symmetric screen motion from named visual roles.
 *
 * `active` follows stack ownership, not travel direction. During a pop the
 * dismissing top screen remains active and uses `enterBack`; the screen being
 * revealed remains inactive and uses `exitBack`.
 */
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
