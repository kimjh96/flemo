import {
  createMidFlightCommitLatch,
  type MidFlightCommitLatch,
  type NavigateStoreApi
} from "@flemo/core";

// One shell-first coherence latch per Router scope, keyed by the scope's
// navigate store instance — the same per-scope keying scopeAnimHoldCoordinator
// uses, and for the same reason: the navigate store is created once per scope,
// stable for its lifetime, and distinct per scope (a nested Router gets its
// own), so two scopes navigating at once can never share a slot. The active
// entering screen arms this latch; the exiting (passive) screen reads it, so
// both sides of one navigation make the same driver decision (see
// createMidFlightCommitLatch in @flemo/core). Held in a module-level WeakMap so
// this pure runtime glue stays out of the public React API and is collected
// with the store when the scope goes away.
const latches = new WeakMap<NavigateStoreApi, MidFlightCommitLatch>();

export default function getScopeMidFlightCommitLatch(
  navigateStore: NavigateStoreApi
): MidFlightCommitLatch {
  let latch = latches.get(navigateStore);
  if (!latch) {
    latch = createMidFlightCommitLatch();
    latches.set(navigateStore, latch);
  }
  return latch;
}
