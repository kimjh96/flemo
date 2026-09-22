import type { InitialTarget } from "@transition/cssTypes";
import {
  type TransitionOptions,
  type Transition,
  type TransitionVariantValue,
  type TransitionName
} from "@transition/typing";

interface CreateRawTransitionProps {
  /** Public name registered on a Router and selected by Route or navigation options. */
  name: TransitionName;
  /** Pose held before an arriving screen starts its first transition. */
  initial: InitialTarget;
  /** Resting pose for both active and inactive screens while the Router is idle. */
  idle: TransitionVariantValue;
  /** Target for `PUSHING-true`, the arriving new top screen. */
  pushOnEnter: TransitionVariantValue;
  /** Target for `PUSHING-false`, the covered screen moving behind. */
  pushOnExit: TransitionVariantValue;
  /** Target for `REPLACING-true`, the arriving replacement screen. */
  replaceOnEnter: TransitionVariantValue;
  /** Target for `REPLACING-false`, the screen being replaced. */
  replaceOnExit: TransitionVariantValue;
  /** Target for `POPPING-true`, the still-active top screen being dismissed. */
  popOnEnter: TransitionVariantValue;
  /** Target for `POPPING-false`, the inactive screen returning from underneath. */
  popOnExit: TransitionVariantValue;
  /** Settled pose for `COMPLETED-true`, the active top screen. */
  completedOnEnter: TransitionVariantValue;
  /** Settled pose for `COMPLETED-false`, the screen left behind the top. */
  completedOnExit: TransitionVariantValue;
  /** Gesture, decorator, and runtime behavior shared by the explicit variants. */
  options?: TransitionOptions;
}

/**
 * Creates screen motion with every status and active-side target explicit.
 * Use this when push, replace, pop, or settled poses cannot share the compact
 * roles accepted by `createTransition`.
 */
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
