import type { BarTransition, BarTransitionName } from "@transition/barTransition/typing";

// Request-agnostic registry of bar transitions, mirroring transitionMap /
// decoratorMap. A binding registers the consumer's createBarTransition results
// here (see useTransitionStyles) so the compiler can emit their CSS and
// <BarTransition name="..."> can resolve them. Empty by default — bar
// transitions are entirely consumer-defined.
export const barTransitionMap = new Map<BarTransitionName, BarTransition>();
