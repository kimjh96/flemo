import overlay from "@transition/decorator/overlay";

import type { Decorator, DecoratorName } from "@transition/decorator/typing";

export const decoratorMap = new Map<DecoratorName, Decorator>([["overlay", overlay]]);
