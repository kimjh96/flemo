// The self-pop guard balances flemo-initiated `history.back()` / `history.go()`
// calls against the `popstate` events they produce, so the popstate listener
// doesn't re-process a traversal the navigation queue already owns.
//
// `createSelfPopGuard` makes an instance-scoped guard. With multiple browser
// <Router>s on one page, a `go(-n)` by one Router fires every Router's popstate
// handler, so a single shared counter would mis-attribute the event. Each
// browser Router creates its OWN guard instance instead, injecting `mark` into
// its navigation controller and `consume` into its history sync.

export interface SelfPopGuard {
  // Mark that flemo itself is about to traverse the history (back / go).
  mark(): void;
  // Returns `true` once for each prior `mark`, balancing flemo-initiated
  // traversals against incoming popstate events. A genuine browser back/forward
  // press is the event that overflows the count.
  consume(): boolean;
}

export function createSelfPopGuard(): SelfPopGuard {
  let count = 0;

  return {
    mark() {
      count += 1;
    },
    consume() {
      if (count > 0) {
        count -= 1;
        return true;
      }
      return false;
    }
  };
}

// The default shared instance, kept for back-compat. A root <Router> with no
// sibling Routers, the step navigation, and tests use these module-level
// wrappers; a keyed multi-Router setup creates its own guards instead.
const defaultGuard = createSelfPopGuard();

/**
 * Marks that flemo itself is about to call `window.history.back()`. The
 * `popstate` it produces is then consumed by `consumeSelfInducedPop` so the
 * popstate listener doesn't re-process a pop the navigation queue already owns.
 */
export function markSelfInducedPop() {
  defaultGuard.mark();
}

/**
 * Returns `true` once for each prior `markSelfInducedPop` call, balancing
 * flemo-initiated `history.back()` calls against incoming `popstate` events.
 * A genuine browser back/forward press is the event that overflows the count.
 */
export function consumeSelfInducedPop(): boolean {
  return defaultGuard.consume();
}
