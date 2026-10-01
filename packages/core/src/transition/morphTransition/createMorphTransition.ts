import type { InitialTarget } from "@transition/cssTypes";
import type { TransitionVariantValue } from "@transition/typing";

import type {
  MorphTransition,
  MorphTransitionName,
  MorphTransitionOptions
} from "@transition/morphTransition/typing";

interface CreateMorphProps {
  /** Public name registered on a Router and selected by a `Morph`. */
  name: MorphTransitionName;
  /**
   * Additional from-pose for the arriving element while it starts over the
   * measured departure box. `{ opacity: 0 }` starts a cross-fade.
   */
  initial: InitialTarget;
  /** Resting pose and the departing element's pose before the cut. */
  idle: TransitionVariantValue;
  /**
   * Target for the arriving side, which is the element that flies. Its own
   * duration times the flight; otherwise the screen clock, then 0.4s, wins. A
   * NESTED Morph is the exception: its container's flight is already carrying
   * it, so it grows on that clock and its own duration is not consulted.
   */
  enter: TransitionVariantValue;
  /**
   * End-pose used to cut the departing side from the first frame. End hidden
   * unless intentionally painting the departure behind the flight.
   */
  exit: TransitionVariantValue;
  /** Geometry, cross-fade, radius, and screen-carrying behavior for the pair. */
  options?: MorphTransitionOptions;
}

/**
 * Creates shared-element motion for two `Morph` elements with one `layoutId`.
 * `enter` and `exit` are simultaneous sides: the arriving element flies while
 * the departing element is cut. Pop reverses which active flag owns each side.
 */
export default function createMorphTransition({
  name,
  initial,
  idle,
  enter,
  exit,
  options
}: CreateMorphProps): MorphTransition {
  return {
    name,
    initial,
    variants: {
      ["IDLE-true"]: idle,
      ["IDLE-false"]: idle,
      ["PUSHING-true"]: enter,
      ["PUSHING-false"]: exit,
      ["REPLACING-true"]: enter,
      ["REPLACING-false"]: exit,
      // Reversed on POP, and that is not a typo. The active flag follows the
      // STACK, not the direction of travel: the screen being dismissed is still
      // the top one, so it is the "-true" side, and the screen the user is
      // returning to — where the shared element ARRIVES — is "-false".
      ["POPPING-true"]: exit,
      ["POPPING-false"]: enter,
      ["COMPLETED-true"]: idle,
      ["COMPLETED-false"]: idle
    },
    ...options
  };
}
