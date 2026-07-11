import type { NavigateStatus } from "@navigate/store";

import type { TransitionName } from "@transition/typing";

// Attribute that suppresses the next compiled keyframe for an element whose
// swipe already animated it all the way out (set by the swipe-commit path).
export const SKIP_ANIMATION_ATTR = "data-flemo-skip-animation";

// The engine depends on a MINIMAL injected interface rather than a concrete
// store, so it stays framework-neutral: any binding (React, Vue, Solid, ...)
// wires these from its own request-scoped stores.
export interface TransitionEngineDeps {
  // The navigation task currently awaiting this transition's completion.
  getTransitionTaskId: () => string | null;
  setDragStatus: (status: "IDLE" | "PENDING") => void;
  setReplaceTransitionStatus: (status: "IDLE" | "PENDING") => void;
}

export interface ScreenLifecycleInput {
  // Read live so the engine sees the current DOM nodes even if the binding's
  // refs changed since registration. `scope` is the animated element; the
  // others are cleaned up alongside it when the transition completes.
  getElements: () => {
    scope: HTMLElement | null;
    decorator?: HTMLElement | null;
    bars?: (HTMLElement | null | undefined)[];
  };
  transitionName: TransitionName;
  prevTransitionName: TransitionName;
  status: NavigateStatus;
  isActive: boolean;
  // Whether the binding's anim-hold has released for this transition. The rAF
  // player starts exactly at release (the compiled hold/park rules own the
  // pre-release frames); pass true when the binding has no hold concept.
  animHoldReleased: boolean;
}

export interface TransitionEngine {
  // Drives the navigation task lifecycle for the active screen and the
  // COMPLETED cleanup. Call from a layout-effect-equivalent whenever the
  // inputs change; the returned disposer detaches any pending listener (call
  // it before the next invocation and on teardown), mirroring a React effect.
  driveScreenLifecycle: (input: ScreenLifecycleInput) => () => void;
}
