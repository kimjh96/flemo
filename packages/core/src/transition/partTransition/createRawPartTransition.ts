import type { InitialTarget } from "@transition/cssTypes";

import {
  type PartTransition,
  type PartTransitionName,
  type PartTransitionOptions,
  type PartVariantValue
} from "@transition/partTransition/typing";

interface CreateRawPartProps {
  name: PartTransitionName;
  initial: InitialTarget;
  idle: PartVariantValue;
  pushOnEnter: PartVariantValue;
  pushOnExit: PartVariantValue;
  replaceOnEnter: PartVariantValue;
  replaceOnExit: PartVariantValue;
  popOnEnter: PartVariantValue;
  popOnExit: PartVariantValue;
  completedOnEnter: PartVariantValue;
  completedOnExit: PartVariantValue;
  options?: PartTransitionOptions;
}

// Full-control factory: every status×active variant is set explicitly, for when
// the idle / enter / exit collapse in createPartTransition is too coarse. Mirrors
// createRawDecorator.
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
