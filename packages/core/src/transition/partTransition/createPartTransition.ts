import type { InitialTarget } from "@transition/cssTypes";
import { type TransitionVariantValue } from "@transition/typing";

import {
  type PartTransition,
  type PartTransitionName,
  type PartTransitionOptions
} from "@transition/partTransition/typing";

interface CreatePartProps {
  name: PartTransitionName;
  initial: InitialTarget;
  // Rest / active state — held on IDLE-*, the entering side of PUSH/REPLACE
  // (PUSHING-true / REPLACING-true), POPPING-true and COMPLETED-true. The bar
  // element sits here when its screen isn't shifting into / out of the
  // background.
  idle: TransitionVariantValue;
  // The screen is moving INTO the background (becoming "previous"): PUSHING-false
  // / REPLACING-false (peak) and COMPLETED-false (settled behind). For a title
  // cross-fade this is the faded-out state.
  enter: TransitionVariantValue;
  // The previously-behind screen returning to active: POPPING-false. Animates
  // from `enter` back toward the rest state. Match `exit` to `idle` to land
  // softly without a snap.
  exit: TransitionVariantValue;
  options?: PartTransitionOptions;
}

// Factory mirroring createDecorator: collapses the 3-state (idle / enter / exit)
// model into the 8 status×active variants the compiler consumes, plus the
// optional swipe hooks. Reference the result by `name` from <PartTransition>.
export default function createPartTransition({
  name,
  initial,
  idle,
  enter,
  exit,
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
      ["POPPING-true"]: idle,
      ["POPPING-false"]: exit,
      ["COMPLETED-true"]: idle,
      ["COMPLETED-false"]: enter
    },
    ...options
  };
}
