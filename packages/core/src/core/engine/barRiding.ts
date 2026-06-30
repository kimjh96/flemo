import type { History } from "@history/store";

import type { NavigateStatus } from "@navigate/store";

import type { SharedBarPresenceLike } from "@core/engine/createSwipeController";

const BAR_RIDING_ATTR = "data-flemo-bar-riding";

// Everything driveBarRiding needs, injected so the module stays framework-
// neutral: any binding (React, Vue, Solid, ...) wires these from its own
// request-scoped stores and element refs.
export interface BarRidingInput {
  topBar: HTMLElement | null;
  navBar: HTMLElement | null;
  // This screen is the current top (active) or the one directly beneath it —
  // the only two that take part in a transition.
  isTopOrTopPrev: boolean;
  // When active (the top), the partner is the screen beneath; otherwise (the
  // prev) the partner is the top.
  isActive: boolean;
  index: number;
  hasTopBar: boolean;
  hasNavBar: boolean;
  getStatus: () => NavigateStatus;
  getHistories: () => History[];
  getSharedBars: () => Record<string, SharedBarPresenceLike | undefined>;
  subscribeStatus: (listener: () => void) => () => void;
  subscribeSharedBars: (listener: () => void) => () => void;
}

// Toggle `data-flemo-bar-riding` on a screen's shared bars based on partner
// ownership, so the compiled sibling rule rides the bar along with the screen
// during a CSS-driven transition (push / pop / replace). When the partner
// screen owns the same bar, the bar must NOT ride (it hands over seamlessly);
// when the partner doesn't own it, the bar rides. Re-applies on status /
// shared-bar changes, because a partner Screen may register its bars slightly
// after this screen reads them (commit-order races). Swipe-time riding is
// handled separately inside the swipe controller.
//
// Call from a layout-effect-equivalent so the attribute is set before the first
// transition frame paints; the returned disposer unsubscribes and clears the
// attribute. Framework-neutral: no framework runtime, only DOM + injected reads.
export default function driveBarRiding(input: BarRidingInput): () => void {
  const { topBar, navBar } = input;
  if (!topBar && !navBar) return () => {};

  const apply = () => {
    const status = input.getStatus();
    const transitioningNow = status === "PUSHING" || status === "POPPING" || status === "REPLACING";
    if (!transitioningNow || !input.isTopOrTopPrev) {
      topBar?.removeAttribute(BAR_RIDING_ATTR);
      navBar?.removeAttribute(BAR_RIDING_ATTR);
      return;
    }
    const histories = input.getHistories();
    const partnerId = input.isActive ? histories[input.index - 1]?.id : histories[input.index]?.id;
    const partnerBars = partnerId ? input.getSharedBars()[partnerId] : undefined;
    const rideApp = input.hasTopBar && !partnerBars?.topBar;
    const rideNav = input.hasNavBar && !partnerBars?.bottomBar;
    if (topBar) topBar.setAttribute(BAR_RIDING_ATTR, rideApp ? "true" : "false");
    if (navBar) navBar.setAttribute(BAR_RIDING_ATTR, rideNav ? "true" : "false");
  };

  apply();
  const unsubStatus = input.subscribeStatus(apply);
  const unsubSharedBars = input.subscribeSharedBars(apply);
  return () => {
    unsubStatus();
    unsubSharedBars();
    topBar?.removeAttribute(BAR_RIDING_ATTR);
    navBar?.removeAttribute(BAR_RIDING_ATTR);
  };
}
