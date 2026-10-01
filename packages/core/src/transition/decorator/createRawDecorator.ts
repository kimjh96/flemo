import type { InitialTarget } from "@transition/cssTypes";

import {
  type DecoratorName,
  type Decorator,
  type DecoratorOptions,
  type DecoratorVariantValue
} from "./typing";

interface CreateRawDecoratorProps {
  /** Public name registered on a Router and selected by a screen transition. */
  name: DecoratorName;
  /** From-pose for a decorator entering on a newly mounted screen. */
  initial: InitialTarget;
  /** Resting pose for both sides while the Router is idle. */
  idle: DecoratorVariantValue;
  /** Target for the decorator on `PUSHING-true`, the arriving active screen. */
  pushOnEnter: DecoratorVariantValue;
  /** Target for the decorator on `PUSHING-false`, the screen moving behind. */
  pushOnExit: DecoratorVariantValue;
  /** Target for the decorator on `REPLACING-true`, the arriving replacement. */
  replaceOnEnter: DecoratorVariantValue;
  /** Target for the decorator on `REPLACING-false`, the replaced screen. */
  replaceOnExit: DecoratorVariantValue;
  /** Target for the decorator on `POPPING-true`, the top screen being dismissed. */
  popOnEnter: DecoratorVariantValue;
  /** Target for the decorator on `POPPING-false`, the returning screen. */
  popOnExit: DecoratorVariantValue;
  /** Settled pose for the decorator on `COMPLETED-true`, the active top screen. */
  completedOnEnter: DecoratorVariantValue;
  /** Settled pose for the decorator on `COMPLETED-false`, the covered screen. */
  completedOnExit: DecoratorVariantValue;
  /** Decorator behavior; omitted clocks inherit from the naming transition. */
  options?: DecoratorOptions;
}

/**
 * Creates a decorator with every status and active-side target explicit.
 * Omitted duration and delay still inherit from the screen transition that
 * names it by the same variant key; easing never inherits.
 */
export default function createRawDecorator({
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
}: CreateRawDecoratorProps): Decorator {
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
