import applyTransitionStyles from "@transition/applyTransitionStyles";
import { transitionMap } from "@transition/transition";

import type { Transition } from "@transition/typing";

import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

import type { Decorator } from "@transition/decorator/typing";
import type { PartTransition } from "@transition/partTransition/typing";

// Live registrations per definition name. Multiple Routers can register the
// SAME name at once: bouncing between zones mounts several instances of a
// nested Router (each registering its zone's transitions), and React
// <Activity> runs a frozen Router's insertion-effect cleanup while a sibling
// still animates with those names. An unconditional delete then strips a
// definition another Router is actively using — its transitions resolve to
// nothing, every navigation completes instantly, and the "screens stop
// animating until something remounts" state sticks. Reference counting keeps
// a name registered until its LAST registrant cleans up.
const transitionRefs = new Map<string, number>();
const decoratorRefs = new Map<string, number>();
const partTransitionRefs = new Map<string, number>();

const retain = (refs: Map<string, number>, name: string) => {
  refs.set(name, (refs.get(name) ?? 0) + 1);
};

// Returns true when the last registration for `name` was just released.
const release = (refs: Map<string, number>, name: string) => {
  const remaining = (refs.get(name) ?? 1) - 1;
  if (remaining <= 0) {
    refs.delete(name);
    return true;
  }
  refs.set(name, remaining);
  return false;
};

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
  for (const transition of transitions) {
    transitionMap.set(transition.name, transition);
    retain(transitionRefs, transition.name);
  }
  for (const decorator of decorators) {
    decoratorMap.set(decorator.name, decorator);
    retain(decoratorRefs, decorator.name);
  }
  for (const partTransition of partTransitions) {
    partTransitionMap.set(partTransition.name, partTransition);
    retain(partTransitionRefs, partTransition.name);
  }
  applyTransitionStyles();
  return () => {
    for (const transition of transitions) {
      if (release(transitionRefs, transition.name)) transitionMap.delete(transition.name);
    }
    for (const decorator of decorators) {
      if (release(decoratorRefs, decorator.name)) decoratorMap.delete(decorator.name);
    }
    for (const partTransition of partTransitions) {
      if (release(partTransitionRefs, partTransition.name))
        partTransitionMap.delete(partTransition.name);
    }
    applyTransitionStyles();
  };
}
