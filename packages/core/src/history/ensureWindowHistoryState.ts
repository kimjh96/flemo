import type { TransitionName } from "@transition/typing";

import isServer from "@utils/isServer";

// Seed `window.history.state` with the root frame on first load, so a later
// back/forward has flemo-shaped state to read. No-op on the server or once a
// flemo frame is already present. Framework-neutral DOM.
export default function ensureWindowHistoryState(defaultTransitionName: TransitionName) {
  if (isServer()) return;
  if (window.history.state?.index) return;

  window.history.replaceState(
    {
      id: "root",
      index: 0,
      status: "IDLE",
      params: {},
      transitionName: defaultTransitionName,
      layoutId: null
    },
    "",
    window.location.href
  );
}
