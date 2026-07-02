import { transitionMap } from "@transition/transition";

import type { Transition, TransitionName } from "@transition/typing";

// The registered transition for a name, falling back to the built-in "none"
// when the name isn't registered (a consumer referencing a transition it
// forgot to pass to <Router>). "none" always exists, so the result is total.
export default function resolveTransition(transitionName: TransitionName): Transition {
  return (transitionMap.get(transitionName) ?? transitionMap.get("none"))!;
}
