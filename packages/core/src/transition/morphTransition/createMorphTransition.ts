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
   * Additional starting style for the element on the new screen while it starts
   * over the measured box of the element on the old screen. `{ opacity: 0 }`
   * starts a cross-fade.
   */
  initial: InitialTarget;
  /** Resting style, and the style of the element on the old screen before it disappears. */
  idle: TransitionVariantValue;
  /**
   * Target for the element on the new screen, which is the element that moves.
   * Its own duration sets the length; otherwise the screen transition's timing,
   * then 0.4s, is used. A NESTED Morph is the exception: its container's
   * transition already moves it, so it grows with that timing and its own
   * duration is not consulted.
   */
  enter: TransitionVariantValue;
  /**
   * End style the element on the old screen takes at once, from the first
   * frame. End hidden unless you intentionally want that element rendered
   * behind the transition.
   */
  exit: TransitionVariantValue;
  /** Geometry, cross-fade, radius, and whole-screen (`carry`) behavior for the pair. */
  options?: MorphTransitionOptions;
}

/**
 * Creates shared-element motion for two `Morph` elements with one `layoutId`.
 * `enter` and `exit` are simultaneous sides: the element on the new screen moves
 * while the element on the old screen disappears at once. Pop reverses which
 * active flag each side uses.
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
