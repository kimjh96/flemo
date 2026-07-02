import type { NavigateStatus } from "@navigate/store";

// Anchoring a transition's START to the screen's first painted frame,
// framework-neutral. iOS WebKit anchors a CSS animation's timeline when the
// style change commits; when the entering screen's first frame is expensive
// (layout + raster of a heavy subtree on a mobile GPU), the timeline keeps
// running while nothing new is presented and the opening of the transition is
// never displayed — it reads as abbreviated. The compiled sheet's hold rule
// (`[data-flemo-anim-hold="true"]`) pins `animation-play-state: paused`; a
// binding renders the attribute ON in the same tick its status attribute
// changes, then releases it via `scheduleAnimHoldRelease` so the full duration
// plays against already-painted layers.

export interface AnimHoldInput {
  status: NavigateStatus;
  // This screen is the current top (active) or the one directly beneath it —
  // the only two that take part in a transition.
  isTopOrTopPrev: boolean;
  transitionName: string;
}

// Identity of the transition segment a screen must hold for, or null when the
// screen is at rest / not participating. A binding keys its hold state on this:
// a NEW key (fresh push/pop/replace) re-arms the hold; null clears it.
export function animHoldKey(input: AnimHoldInput): string | null {
  const transitioning =
    input.status === "PUSHING" || input.status === "POPPING" || input.status === "REPLACING";
  if (!transitioning || !input.isTopOrTopPrev) return null;
  return `${input.status}:${input.transitionName}`;
}

export const ANIM_HOLD_RELEASE_BACKSTOP_MS = 300;

// Schedules the release of a held animation after the screen's first painted
// frame: the first rAF fires before that (heavy) paint, the second after it,
// so releasing on the second frame starts the animation against painted,
// rasterized content — adaptively costing ~2 frames on a fast engine and
// exactly "one heavy frame + one tick" on a slow one. The timeout is
// insurance, not a wait: rAF suspends in background tabs, and a paused
// animation left behind would never fire `animationend`, hanging the
// navigation queue. `release` must be idempotent. Returns a canceller.
export function scheduleAnimHoldRelease(release: () => void): () => void {
  let secondFrame = 0;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(release);
  });
  const fallback = setTimeout(release, ANIM_HOLD_RELEASE_BACKSTOP_MS);
  return () => {
    cancelAnimationFrame(firstFrame);
    if (secondFrame) cancelAnimationFrame(secondFrame);
    clearTimeout(fallback);
  };
}
