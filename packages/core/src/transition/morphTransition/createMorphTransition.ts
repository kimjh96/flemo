import type { InitialTarget } from "@transition/cssTypes";
import type { TransitionVariantValue } from "@transition/typing";

import type {
  MorphTransition,
  MorphTransitionName,
  MorphTransitionOptions
} from "@transition/morphTransition/typing";

interface CreateMorphProps {
  name: MorphTransitionName;
  // Where the ARRIVING element starts, beyond its measured geometry: the pose
  // it holds on the flight's first frame, while it still sits exactly on top of
  // the element it is replacing. `{ opacity: 0 }` is the cross-fade's start.
  initial: InitialTarget;
  // Rest. Held whenever no flight involves this element, and the pose the
  // DEPARTING element starts from.
  idle: TransitionVariantValue;
  // The arriving element's target: where the travelling element lands. Its
  // `options` time the whole flight — the travel included — so this is the
  // variant that decides how long a morph takes.
  enter: TransitionVariantValue;
  // The departing element's target: what the element left behind does while the
  // arrival takes its place. `{ opacity: 0 }` completes the cross-fade.
  exit: TransitionVariantValue;
  options?: MorphTransitionOptions;
}

// Factory mirroring createPartTransition: collapses the 3-state (idle / enter /
// exit) model into the status×active variants the morph runtime consumes.
//
// A morph pairs the two elements that share a `layoutId` across a flight, so
// "enter" and "exit" are not two moments of one element — they are the two
// SIDES, animating at the same time. Push, replace and pop use the same pair of
// targets; reach for createRawMorphTransition when a status needs its own.
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
