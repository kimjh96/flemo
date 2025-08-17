import {
  type DecoratorName,
  type Decorator,
  type DecoratorOptions
} from "@transition/decorator/typing";
import { type TransitionVariantValue } from "@transition/typing";

import type { TargetAndTransition } from "motion";

interface CreateDecoratorProps {
  name: DecoratorName;
  initial: TargetAndTransition;
  enter: TransitionVariantValue;
  exit: TransitionVariantValue;
  options?: DecoratorOptions;
}

export default function createDecorator({
  name,
  initial,
  enter,
  exit,
  options
}: CreateDecoratorProps): Decorator {
  return {
    name,
    initial,
    variants: {
      ["IDLE-true"]: enter,
      ["IDLE-false"]: enter,
      ["PUSHING-false"]: exit,
      ["PUSHING-true"]: enter,
      ["REPLACING-false"]: exit,
      ["REPLACING-true"]: enter,
      ["POPPING-false"]: enter,
      ["POPPING-true"]: enter,
      ["COMPLETED-false"]: exit,
      ["COMPLETED-true"]: enter
    },
    ...options
  };
}
