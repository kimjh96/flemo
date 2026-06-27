import type { PartTransition, PartTransitionName } from "@transition/partTransition/typing";

// Request-agnostic registry of part transitions, mirroring transitionMap /
// decoratorMap. A binding registers the consumer's createPartTransition results
// here (see useTransitionStyles) so the compiler can emit their CSS and
// <Part name="..."> can resolve them. Empty by default — bar
// transitions are entirely consumer-defined.
export const partTransitionMap = new Map<PartTransitionName, PartTransition>();
