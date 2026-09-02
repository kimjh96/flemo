import type { NavigateStatus } from "@navigate/store";

import type { TransitionName } from "@transition/typing";

// Attribute that suppresses the next compiled keyframe for an element whose
// swipe already animated it all the way out (set by the swipe-commit path).
// Re-exported from the DOM protocol so the name has ONE definition; the
// engine's public types keep exporting it from here.
export { SKIP_ANIMATION_ATTR } from "@dom/attributes";

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
    // The screen's container. Passed rather than the overlays themselves
    // because a `<Layer>` overlay is not always IN this container — a nested
    // screen's is in an ancestor's host — so finding it is a rule rather than
    // a ref, and the rule belongs with the protocol (see layerRiders.ts).
    screenContainer?: HTMLElement | null;
    // The Router scope's part layer (see @screen/partLayer): where this
    // screen's matched shared-bar <Part> elements are staged for the flight so
    // they are not painted under the other screen's opaque surface. Resolved by
    // the binding because only a Router knows which box bounds its screens.
    // Omitted by a binding that renders no layer; staging is then skipped.
    partLayer?: HTMLElement | null;
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
  // Internal. Number of in-flight tasks currently holding an active-scope
  // cancel-resume budget entry. Exposed only for the leak-regression test that
  // asserts the bookkeeping never grows unbounded; not part of the binding
  // contract, and bindings must not depend on it.
  activeResumeEntryCount: () => number;
}
