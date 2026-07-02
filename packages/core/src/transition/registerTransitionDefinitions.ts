import applyTransitionStyles from "@transition/applyTransitionStyles";
import { transitionMap } from "@transition/transition";

import type { Transition } from "@transition/typing";

import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

import type { Decorator } from "@transition/decorator/typing";
import type { PartTransition } from "@transition/partTransition/typing";

// Registers user-provided transitions / decorators / part-transitions with the
// global maps and (re)writes the compiled stylesheet, returning the cleanup
// that unregisters them and recompiles. Framework-neutral: a binding calls
// this from its style-injection lifecycle (React's useInsertionEffect, a
// Svelte/Solid mount hook) so the sheet is in place before screens commit
// their data-* attributes.
export default function registerTransitionDefinitions(
  transitions: Transition[],
  decorators: Decorator[],
  partTransitions: PartTransition[] = []
): () => void {
  for (const transition of transitions) transitionMap.set(transition.name, transition);
  for (const decorator of decorators) decoratorMap.set(decorator.name, decorator);
  for (const partTransition of partTransitions)
    partTransitionMap.set(partTransition.name, partTransition);
  applyTransitionStyles();
  return () => {
    for (const transition of transitions) transitionMap.delete(transition.name);
    for (const decorator of decorators) decoratorMap.delete(decorator.name);
    for (const partTransition of partTransitions) partTransitionMap.delete(partTransition.name);
    applyTransitionStyles();
  };
}
