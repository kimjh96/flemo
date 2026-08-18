import type { NavigateStatus } from "@navigate/store";

import type { SharedBarId, SharedBarMetadata, SharedBarsMetadata } from "@screen/store";

// Presence of a partner screen's shared bars, used to decide ride-along.
// Defined HERE (the pure decision module) — the swipe controller re-exports
// it, so the engine layer depends on the screen layer, never the reverse.
export interface SharedBarPresenceLike {
  topBar: boolean;
  bottomBar: boolean;
}

export interface BarRidingInput {
  status: NavigateStatus;
  // This screen is the current top (active) or the one directly beneath it —
  // the only two that take part in a transition.
  isTopOrTopPrev: boolean;
  hasTopBar: boolean;
  hasNavBar: boolean;
  topBarId?: SharedBarId;
  bottomBarId?: SharedBarId;
  // The partner screen's shared-bar presence (the screen this one would hand its
  // bars over to): the active top's partner is the screen beneath; a prev
  // screen's partner is the top. The binding resolves it and can subscribe to
  // just that entry.
  partnerBars: SharedBarPresenceLike | undefined;
  partnerMetadata?: SharedBarsMetadata;
}

// A metadata object represents a present bar. Missing IDs deliberately retain
// the legacy position-only hand-over: two unlabelled bars at the same position
// match, while an explicitly labelled bar never aliases an unlabelled one.
export function sharedBarsMatch(
  current: SharedBarMetadata | undefined,
  partner: SharedBarMetadata | undefined
): boolean {
  return !!current && !!partner && current.id === partner.id;
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
  const currentTop = input.hasTopBar ? { id: input.topBarId } : undefined;
  const currentBottom = input.hasNavBar ? { id: input.bottomBarId } : undefined;
  const partnerTop = input.partnerMetadata?.topBar ?? (input.partnerBars?.topBar ? {} : undefined);
  const partnerBottom =
    input.partnerMetadata?.bottomBar ?? (input.partnerBars?.bottomBar ? {} : undefined);
  return {
    app: input.hasTopBar && !sharedBarsMatch(currentTop, partnerTop),
    nav: input.hasNavBar && !sharedBarsMatch(currentBottom, partnerBottom)
  };
}
