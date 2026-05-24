import cupertino from "@transition/cupertino";
import layout from "@transition/layout";
import material from "@transition/material";
import none from "@transition/none";

import type { TransitionName, Transition } from "@transition/typing";

export const transitionMap = new Map<TransitionName, Transition>([
  ["none", none],
  ["cupertino", cupertino],
  ["material", material],
  ["layout", layout]
]);
