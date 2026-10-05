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
  /** Starting style for a part entering on a newly mounted screen. */
  initial: InitialTarget;
  /** Resting style for both sides while the Router is idle. */
  idle: PartVariantValue;
  /** Target for the part on `PUSHING-true`, the new top screen. */
  pushOnEnter: PartVariantValue;
  /** Target for the part on `PUSHING-false`, the screen moving behind. */
  pushOnExit: PartVariantValue;
  /** Target for the part on `REPLACING-true`, the new screen that replaces the current one. */
  replaceOnEnter: PartVariantValue;
  /** Target for the part on `REPLACING-false`, the screen being replaced. */
  replaceOnExit: PartVariantValue;
  /** Target for the part on `POPPING-true`, the closing top screen. */
  popOnEnter: PartVariantValue;
  /** Target for the part on `POPPING-false`, the screen returning from behind. */
  popOnExit: PartVariantValue;
  /** Style after the transition ends for the part on `COMPLETED-true`, the active top screen. */
  completedOnEnter: PartVariantValue;
  /** Style after the transition ends for the part on `COMPLETED-false`, the covered screen. */
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
 * Parts that only declare styles still inherit the matching timing of the
 * screen they are on and follow its swipe. Any `onSwipe*` callback replaces
 * that default swipe-following for the Part. Duration and delay inherit, but
 * easing does not. Use the screen's easing on a Part that must stay at the same
 * point along its path as the screen during automatic and interactive navigation.
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
