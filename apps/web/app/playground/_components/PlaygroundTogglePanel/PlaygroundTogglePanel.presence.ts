import type { History } from "@flemo/core";
import type { SharedBarPresence } from "@flemo/react";

// One row per currently-mounted screen: flemo registers a screen's shared-bar
// presence on mount and removes it on unmount, so `sharedBars` reflects what's
// live right now. We join its `id` keys against the history stack to label
// each row by pathname. This is the concrete read-out behind "pinned across
// screens vs per-screen": the nav bar registers on Library + Search + Album,
// while the app bar is shared only on Library (Search/Album use a per-screen
// `appBar`, so their `appBar` reads false here).
export interface PresenceRow {
  id: string;
  pathname: string;
  appBar: boolean;
  navigationBar: boolean;
}

export function buildPresenceRows(
  histories: History[],
  sharedBars: Record<string, SharedBarPresence>
): PresenceRow[] {
  return Object.entries(sharedBars).map(([id, presence]) => {
    const history = histories.find((entry) => entry.id === id);

    return {
      id,
      pathname: history?.pathname ?? id,
      appBar: presence.appBar,
      navigationBar: presence.navigationBar
    };
  });
}
