import { type TransitionVariantValue } from "@transition/typing";

import { type DecoratorName, type Decorator, type DecoratorOptions } from "./typing";

import type { TargetAndTransition } from "motion";

interface CreateRawDecoratorProps {
  name: DecoratorName;
  initial: TargetAndTransition;
  idle: TransitionVariantValue;
  pushOnEnter: TransitionVariantValue;
  pushOnExit: TransitionVariantValue;
  replaceOnEnter: TransitionVariantValue;
  replaceOnExit: TransitionVariantValue;
  popOnEnter: TransitionVariantValue;
  popOnExit: TransitionVariantValue;
  completedOnEnter: TransitionVariantValue;
  completedOnExit: TransitionVariantValue;
  options?: DecoratorOptions;
}

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
