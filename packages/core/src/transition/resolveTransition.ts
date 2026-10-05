import { transitionMap } from "@transition/transition";

import type { Transition, TransitionName } from "@transition/typing";

import { warnUnregistered } from "@utils/devWarn";

// The registered transition for a name, falling back to the built-in "none"
// when the name isn't registered (a consumer referencing a transition it
// forgot to pass to <Router>). "none" always exists, so the result is total.
//
// Total, and in development also LOUD: the fallback is indistinguishable from
// a transition that animates nothing, so a misspelled name used to read as a
// screen that simply cuts. Said once per name, and only once the registry has
// anything in it — an empty map means the Router has not registered yet, which
// is a render order, not a mistake.
//
// A non-empty map does not prove that either. A nested Router that mounts after
// another one has registered renders its screens BEFORE its own registration
// runs, and those screens resolve their Router's own names into a map holding
// only the other Router's. A binding resolving during render passes `quiet`
// and asks again once its commit is done, when every Router in it has
// registered.
export default function resolveTransition(
  transitionName: TransitionName,
  { quiet = false }: { quiet?: boolean } = {}
): Transition {
  const registered = transitionMap.get(transitionName);
  if (!registered && !quiet && transitionMap.size > 0) {
    warnUnregistered(
      "transition",
      transitionName,
      "The screen falls back to `none`, which animates nothing. Pass it to `<Router transitions={[...]}>`."
    );
  }
  return (registered ?? transitionMap.get("none"))!;
}
