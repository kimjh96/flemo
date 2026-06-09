import type { InitialTarget } from "@transition/cssTypes";
import { type TransitionVariantValue } from "@transition/typing";

import {
  type DecoratorName,
  type Decorator,
  type DecoratorOptions
} from "@transition/decorator/typing";

interface CreateDecoratorProps {
  name: DecoratorName;
  initial: InitialTarget;
  // Resting state for the active screen and any screen that isn't currently
  // shifting into / out of the background. Held at IDLE-*, COMPLETED-true,
  // POPPING-true, and the entering side of PUSH/REPLACE. None of those slots
  // are when this decorator should be visible, so for overlays this is the
  // invisible state.
  idle: TransitionVariantValue;
  // Target state for the screen that's moving INTO the background, the one
  // becoming the "previous" screen. Used on PUSHING-false / REPLACING-false
  // (peak) and COMPLETED-false (settled). For overlays this is the dim state.
  enter: TransitionVariantValue;
  // Target state for the screen moving OUT of the background, the previously-
  // behind screen returning to active on POPPING-false. Animates from `enter`
  // (its prior settled position) to `exit`. Match `exit` to `idle` to land
  // softly on the active rest rule without a snap.
  exit: TransitionVariantValue;
  options?: DecoratorOptions;
}

export default function createDecorator({
  name,
  initial,
  idle,
  enter,
  exit,
  options
}: CreateDecoratorProps): Decorator {
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
