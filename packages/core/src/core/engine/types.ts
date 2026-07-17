import type { NavigateStatus } from "@navigate/store";

import type { TransitionName } from "@transition/typing";

import type { MidFlightCommitLatch } from "@core/engine/midFlightCommitLatch";

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
  // The Router scope's shell-first coherence latch (see midFlightCommitLatch).
  // The active entering screen arms it; the passive screen reads it so both
  // sides make the same driver decision. Optional so a binding that never
  // defers children (or a single-screen test) can omit it; a binding that
  // drives real push/replace transitions with shell-first MUST provide the one
  // shared per-scope instance, or the two sides could split across drivers.
  midFlightCommitLatch?: MidFlightCommitLatch;
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
  // The binding has deferred THIS screen's children to a commit that will land
  // mid-transition (shell-first — see shouldMountShellFirst). True only on the
  // ACTIVE entering screen of a push/replace it deferred. For such a transition
  // a heavy mid-flight commit is EXPECTED, which starves a main-thread rAF
  // player and snaps the motion, so the engine declines the player and lets the
  // compiled-CSS compositor drive both participants (block-immune, Safari-like
  // on Blink). The active side uses this directly; it also publishes it to the
  // per-scope latch so the PASSIVE side — a different binding instance that
  // cannot know the entering screen deferred — makes the same decision.
  midFlightCommitExpected?: boolean;
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
