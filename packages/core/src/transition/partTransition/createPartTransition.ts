import type { InitialTarget } from "@transition/cssTypes";

import {
  type PartTransition,
  type PartTransitionName,
  type PartTransitionOptions,
  type PartVariantValue
} from "@transition/partTransition/typing";

interface CreatePartProps {
  name: PartTransitionName;
  // Where the part sits before the entering side's animation begins: this is
  // the FROM of PUSHING-true / REPLACING-true (see FROM_VARIANT), not merely a
  // pre-mount style. Authoring it equal to `idle` is what makes an arriving
  // part hold still, which is the whole of the "it only fades one way" report:
  // the pair was cross-fading on the departure alone because the arrival had
  // nowhere to come from.
  initial: InitialTarget;
  // Rest / active state — held on IDLE-*, the entering side of PUSH/REPLACE
  // (PUSHING-true / REPLACING-true) and COMPLETED-true, and the default for
  // POPPING-true. The bar element sits here when its screen isn't shifting
  // into / out of the background.
  idle: PartVariantValue;
  // The screen is moving INTO the background (becoming "previous"): PUSHING-false
  // / REPLACING-false (peak) and COMPLETED-false (settled behind). For a title
  // cross-fade this is the faded-out state.
  enter: PartVariantValue;
  // The previously-behind screen returning to active: POPPING-false. Animates
  // from `enter` back toward the rest state. Match `exit` to `idle` to land
  // softly without a snap.
  exit: PartVariantValue;
  // The screen being popped OFF the stack: POPPING-true. It is the ACTIVE side,
  // because `data-flemo-active` follows the stack rather than the direction of
  // travel, and it animates from `idle`.
  //
  // Optional, and omitting it holds `idle` — which is what this factory did
  // before the slot existed, so every part authored without it is unchanged.
  // Naming it is what lets a pair of matched parts cross-fade BOTH ways: with
  // only the four slots above, a pop faded the returning part in while the one
  // being dismissed sat at full opacity, and the only way out was to restate
  // all ten variants through createRawPartTransition.
  dismiss?: PartVariantValue;
  options?: PartTransitionOptions;
}

// Factory mirroring createDecorator: collapses the 4-state (idle / enter / exit
// / dismiss) model into the status×active variants the compiler consumes, plus
// the optional swipe hooks. Reference the result by `name` from <PartTransition>.
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
