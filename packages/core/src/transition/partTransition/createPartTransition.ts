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
   * starting style of the part on the new screen, not merely a pre-mount style.
   */
  initial: InitialTarget;
  /**
   * Resting style, also used by the new screen's side of push or replace. It is
   * the default for the active, closing side of a pop when `dismiss` is absent.
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
   * Target for `POPPING-true`, the part on the active top screen that is
   * closing. Omitting it keeps `idle`; provide it to animate both halves of
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
 * Parts that only declare styles inherit the matching timing of the screen they
 * are on and follow its swipe back automatically. Adding any `onSwipe*` callback
 * stops that element from following the swipe by default and gives the
 * callbacks sole control. Duration and delay inherit, but easing does not. Use
 * the screen's easing on a Part that must stay at the same point along its path
 * as the screen during automatic and interactive navigation.
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
