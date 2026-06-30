import type { TransitionName } from "@transition/typing";

import isServer from "@utils/isServer";

// Seed `window.history.state` with this Router's root frame on first load, so a
// later back/forward (including a back into a parent entry that predates a child
// Router) has flemo-shaped state to read. No-op on the server or once this
// Router's frame is already present.
//
// With a `routerKey`, the frame is merged under that key WITHOUT changing the
// URL, preserving any sibling Router's frame in the same entry. A root or nested
// browser Router seeds its own key into the current entry. With `null`, the
// legacy bare seed is used (the keyless back-compat path). Framework-neutral DOM.
export default function ensureWindowHistoryState(
  routerKey: string | null,
  defaultTransitionName: TransitionName,
  rootParams: object = {}
) {
  if (isServer()) return;

  // Seed the frame with the root entry's actual params (a deep link like
  // /posts/:slug carries them), so a useStep pop back onto this entry restores
  // them instead of an empty object.
  const rootFrame = {
    id: "root",
    index: 0,
    status: "IDLE",
    params: rootParams,
    transitionName: defaultTransitionName,
    layoutId: null
  };

  if (routerKey === null) {
    // Index 0 is falsy, so an already-seeded root re-seeds harmlessly (idempotent
    // under strict-mode double mount); a non-root index is preserved.
    if (window.history.state?.index) return;
    window.history.replaceState(rootFrame, "", window.location.href);
    return;
  }

  const current = (window.history.state as Record<string, unknown> | null) ?? {};
  const existing = current[routerKey] as { index?: number } | undefined;
  if (existing?.index) return;

  window.history.replaceState({ ...current, [routerKey]: rootFrame }, "", window.location.href);
}
