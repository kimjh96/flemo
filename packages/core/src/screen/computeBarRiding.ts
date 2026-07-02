import type { NavigateStatus } from "@navigate/store";

import type { SharedBarPresenceLike } from "@core/engine/createSwipeController";

export interface BarRidingInput {
  status: NavigateStatus;
  // This screen is the current top (active) or the one directly beneath it —
  // the only two that take part in a transition.
  isTopOrTopPrev: boolean;
  hasTopBar: boolean;
  hasNavBar: boolean;
  // The partner screen's shared-bar presence (the screen this one would hand its
  // bars over to): the active top's partner is the screen beneath; a prev
  // screen's partner is the top. The binding resolves it and can subscribe to
  // just that entry.
  partnerBars: SharedBarPresenceLike | undefined;
}

// Whether each of a screen's shared bars should "ride along" with the screen
// during a CSS-driven transition (push / pop / replace). A bar rides when the
// partner screen does NOT own the same bar (there is no seamless hand-over); it
// stays put when the partner owns it. Pure decision: the binding renders the
// result onto `data-flemo-bar-riding` in the SAME commit as the bar's status
// attribute, so the compiled rule matches both in one paint and the bar can
// never start its keyframe a frame after the screen. Framework-neutral.
// Swipe-time riding is handled separately, inside the swipe controller.
export default function computeBarRiding(input: BarRidingInput): { app: boolean; nav: boolean } {
  const transitioning =
    input.status === "PUSHING" || input.status === "POPPING" || input.status === "REPLACING";
  if (!transitioning || !input.isTopOrTopPrev) {
    return { app: false, nav: false };
  }
  return {
    app: input.hasTopBar && !input.partnerBars?.topBar,
    nav: input.hasNavBar && !input.partnerBars?.bottomBar
  };
}
