import type { FlemoStores } from "@core/createRouterScope";

import createNavigationController from "@navigate/createNavigationController";

// `pop` never compiles a path — only `push` / `replace` do — so the controller
// built here is given a stub that fails loudly rather than a plausible wrong
// answer, should that ever stop being true.
const UNUSED_BUILD_PATHNAME = (): never => {
  throw new Error("commitScopeBack builds a pop-only controller; it compiles no path.");
};

/**
 * Commit a back navigation on `stores`' Router — the operation a swipe-back
 * finishes with, and the same one the app's own back control performs.
 *
 * WHICH HALF OF THE ENGINE OWNS THE POP DEPENDS ON THE HISTORY BACKEND.
 *
 * A browser Router mounts the history sync, so the browser's history is the
 * source of truth and `driver.back()` is the whole commit: the traversal comes
 * back as an event the sync turns into a store pop, exactly as a real Back
 * press does. Committing through the controller instead would move the store
 * ahead of the browser and mark a guard the sync would then eat.
 *
 * A memory Router mounts NO sync — its traversals must never reach the sync's
 * window-history replay records, which are keyed on `window.history.state` and
 * shared by every browser Router on the page. So nothing listens to its driver,
 * and `driver.back()` alone moves the in-memory index while the stores stay
 * exactly where they were: the popped screen keeps `data-flemo-active`, parks
 * off-stage over the stack it should have left, and swallows every tap that
 * lands on it. There the commit has to drive the stores directly, which is what
 * the navigation controller's `pop` does (the driver stays in step because
 * `pop` calls `back()` itself).
 */
export default function commitScopeBack(stores: FlemoStores): void {
  if (!stores.memory) {
    stores.driver.back();
    return;
  }

  createNavigationController({
    stores,
    buildPathname: UNUSED_BUILD_PATHNAME,
    driver: stores.driver,
    markSelfInduced: stores.markSelfInduced
  }).pop();
}
