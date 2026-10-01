import type { InitialTarget } from "@transition/cssTypes";

import {
  type PartTransition,
  type PartTransitionName,
  type PartTransitionOptions,
  type PartVariantValue
} from "@transition/partTransition/typing";

interface CreatePartProps {
  /** Public name registered on a Router and selected by a `Part`. */
  name: PartTransitionName;
  /**
   * Where the part starts on `PUSHING-true` or `REPLACING-true`. This is the
   * arriving part's from-pose, not merely a pre-mount style.
   */
  initial: InitialTarget;
  /**
   * Resting pose, also used by the arriving side of push or replace. It is the
   * default for the active, dismissing side of a pop when `dismiss` is absent.
   */
  idle: PartVariantValue;
  /** Target for the part whose screen moves into or rests in the background. */
  enter: PartVariantValue;
  /**
   * Target for `POPPING-false`, the part on the screen returning from behind.
   * It animates from `enter`; match this target to `idle` for a seamless rest.
   */
  exit: PartVariantValue;
  /**
   * Target for `POPPING-true`, the part on the active top screen being
   * dismissed. Omitting it holds `idle`; provide it to animate both halves of
   * a matched pair during a pop.
   */
  dismiss?: PartVariantValue;
  /**
   * Optional per-element gesture overrides. Without any `onSwipe*` callback,
   * the declared pop variants follow the screen's swipe progress automatically.
   */
  options?: PartTransitionOptions;
}

/**
 * Creates motion for one named element inside a screen.
 *
 * Pose-only Parts inherit the carrying screen's matching clock and follow its
 * interactive pop automatically. Adding any `onSwipe*` callback opts that
 * element out of the default gesture rider and gives the callbacks sole control.
 * Duration and delay inherit, but easing does not. Use the screen's easing on
 * a Part that must stay at the same spatial phase during automatic and
 * interactive navigation.
 */
export default function createPartTransition({
  name,
  initial,
  idle,
  enter,
  exit,
  dismiss,
  options
}: CreatePartProps): PartTransition {
  return {
    name,
    initial,
    variants: {
      ["IDLE-true"]: idle,
      ["IDLE-false"]: idle,
      ["PUSHING-true"]: idle,
      ["PUSHING-false"]: enter,
      ["REPLACING-true"]: idle,
      ["REPLACING-false"]: enter,
      ["POPPING-true"]: dismiss ?? idle,
      ["POPPING-false"]: exit,
      ["COMPLETED-true"]: idle,
      ["COMPLETED-false"]: enter
    },
    ...options
  };
}
