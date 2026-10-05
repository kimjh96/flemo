import type { InitialTarget } from "@transition/cssTypes";

import {
  type DecoratorName,
  type Decorator,
  type DecoratorOptions,
  type DecoratorVariantValue
} from "@transition/decorator/typing";

interface CreateDecoratorProps {
  /** Public name registered on a Router and selected by a screen transition. */
  name: DecoratorName;
  /** Starting style for a decorator entering on a newly mounted screen. */
  initial: InitialTarget;
  /**
   * Resting style for the active screen. For a dim or wash this is normally the
   * invisible state, including the active screen that closes on pop.
   */
  idle: DecoratorVariantValue;
  /** Target for the screen moving into or resting in the background. */
  enter: DecoratorVariantValue;
  /**
   * Target for `POPPING-false`, the decorator on the returning screen. It
   * animates from `enter`; match this target to `idle` for a seamless rest.
   */
  exit: DecoratorVariantValue;
  /** Decorator behavior; omitted timing comes from the screen transition that sets this decorator. */
  options?: DecoratorOptions;
}

/**
 * Creates a wash or overlay that decorates the inactive side of a transition.
 * Its omitted duration and delay come from the screen transition that sets it, by the
 * same variant key; easing remains the decorator author's choice.
 */
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
