import type { InitialTarget } from "@transition/cssTypes";

import {
  type PartTransition,
  type PartTransitionName,
  type PartTransitionOptions,
  type PartVariantValue
} from "@transition/partTransition/typing";

interface CreateRawPartProps {
  /** Public name registered on a Router and selected by a `Part`. */
  name: PartTransitionName;
  /** From-pose for a part entering on a newly mounted screen. */
  initial: InitialTarget;
  /** Resting pose for both sides while the Router is idle. */
  idle: PartVariantValue;
  /** Target for the part on `PUSHING-true`, the arriving new top screen. */
  pushOnEnter: PartVariantValue;
  /** Target for the part on `PUSHING-false`, the screen moving behind. */
  pushOnExit: PartVariantValue;
  /** Target for the part on `REPLACING-true`, the arriving replacement. */
  replaceOnEnter: PartVariantValue;
  /** Target for the part on `REPLACING-false`, the screen being replaced. */
  replaceOnExit: PartVariantValue;
  /** Target for the part on `POPPING-true`, the top screen being dismissed. */
  popOnEnter: PartVariantValue;
  /** Target for the part on `POPPING-false`, the screen returning from behind. */
  popOnExit: PartVariantValue;
  /** Settled pose for the part on `COMPLETED-true`, the active top screen. */
  completedOnEnter: PartVariantValue;
  /** Settled pose for the part on `COMPLETED-false`, the covered screen. */
  completedOnExit: PartVariantValue;
  /**
   * Optional per-element gesture overrides. Without any `onSwipe*` callback,
   * the declared pop variants follow the screen's swipe progress automatically.
   */
  options?: PartTransitionOptions;
}

/**
 * Creates Part motion with every status and active-side target explicit.
 *
 * Pose-only Parts still inherit the carrying screen's matching clock and ride
 * its swipe. Any `onSwipe*` callback replaces that default rider for the Part.
 * Duration and delay inherit, but easing does not. Use the screen's easing on
 * a Part that must stay at the same spatial phase during automatic and
 * interactive navigation.
 */
export default function createRawPartTransition({
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
}: CreateRawPartProps): PartTransition {
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
