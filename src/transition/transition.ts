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

export const transitionInitialValue = (() => {
  const merged: Record<string, unknown> = Object.create(null);
  const hop = Object.prototype.hasOwnProperty;
  for (const transition of transitionMap.values()) {
    const value = transition.variants["IDLE-true"].value as Record<string, unknown>;
    for (const k in value) {
      if (hop.call(value, k)) {
        merged[k] = value[k];
      }
    }
  }
  return merged;
})();
