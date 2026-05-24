let selfInducedPopCount = 0;

/**
 * Marks that flemo itself is about to call `window.history.back()`. The
 * `popstate` it produces is then consumed by `consumeSelfInducedPop` so the
 * popstate listener doesn't re-process a pop the navigation queue already owns.
 */
export function markSelfInducedPop() {
  selfInducedPopCount += 1;
}

/**
 * Returns `true` once for each prior `markSelfInducedPop` call, balancing
 * flemo-initiated `history.back()` calls against incoming `popstate` events.
 * A genuine browser back/forward press is the event that overflows the count.
 */
export function consumeSelfInducedPop(): boolean {
  if (selfInducedPopCount > 0) {
    selfInducedPopCount -= 1;
    return true;
  }

  return false;
}
