// Per-scope coherence channel for the shell-first compositor takeover.
//
// When an entering screen defers its children to a commit that lands
// MID-transition (shouldMountShellFirst), BOTH participants of that navigation
// must decline the rAF player and let the compiled-CSS compositor drive them —
// otherwise the two sides split across drivers and desync (see
// createTransitionEngine's driver gates). The catch: only the ACTIVE entering
// screen's binding instance knows it deferred (its own mount-time useState
// capture); the PASSIVE (exiting) screen is a different binding instance that
// cannot compute the entering side's decision. This latch carries the fact
// across, keyed by the transition's task id: the active side ARMS it at drive
// time, the passive side READS it for the same task id.
//
// Single-slot by construction, not a growing set: navigation is serialized
// (one transition in flight per scope), so the latch only ever needs to record
// the CURRENT transition. Keying every read by task id makes it leak-proof —
// a stale value left by an interrupted transition can never be read for a
// different task (isArmed compares ids), and there is nothing to prune because
// there is only ever one slot. The active side disarms on COMPLETED for
// hygiene; correctness does not depend on it.
//
// One instance per Router scope (the binding wires that, keyed by the scope's
// navigate store — see getScopeMidFlightCommitLatch in the React binding), so
// nested Routers and two scopes navigating at once never share a slot. No
// window/document access, so this is SSR-safe like the rest of the engine.
export interface MidFlightCommitLatch {
  // Record that THIS transition's entering screen deferred its children to a
  // mid-flight commit. Idempotent; overwrites any prior slot (the previous
  // transition is by then complete or superseded).
  arm: (taskId: string) => void;
  // Whether THIS transition (by task id) was armed. False for any other id,
  // so a stale slot never bleeds into a later transition's decision.
  isArmed: (taskId: string) => boolean;
  // Clear the slot IF it still holds this task id (a no-op once a newer
  // transition re-armed it). Called on the active screen's COMPLETED.
  disarm: (taskId: string) => void;
}

export function createMidFlightCommitLatch(): MidFlightCommitLatch {
  let armedTaskId: string | null = null;
  return {
    arm: (taskId) => {
      armedTaskId = taskId;
    },
    isArmed: (taskId) => armedTaskId === taskId,
    disarm: (taskId) => {
      if (armedTaskId === taskId) armedTaskId = null;
    }
  };
}
