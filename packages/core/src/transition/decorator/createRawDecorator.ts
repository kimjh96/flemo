import type { InitialTarget } from "@transition/cssTypes";

import {
  type DecoratorName,
  type Decorator,
  type DecoratorOptions,
  type DecoratorVariantValue
} from "./typing";

interface CreateRawDecoratorProps {
  name: DecoratorName;
  initial: InitialTarget;
  idle: DecoratorVariantValue;
  pushOnEnter: DecoratorVariantValue;
  pushOnExit: DecoratorVariantValue;
  replaceOnEnter: DecoratorVariantValue;
  replaceOnExit: DecoratorVariantValue;
  popOnEnter: DecoratorVariantValue;
  popOnExit: DecoratorVariantValue;
  completedOnEnter: DecoratorVariantValue;
  completedOnExit: DecoratorVariantValue;
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
