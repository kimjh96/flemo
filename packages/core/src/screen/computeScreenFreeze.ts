import type { NavigateStatus } from "@navigate/store";

import { shallowFreeze } from "@core/engine/diagnosticFlags";

// Test seam re-export: the cached `flemo:freeze` read lives in the flag
// registry, but the suites reach it through this module.
export { resetShallowFreezeForTesting } from "@core/engine/diagnosticFlags";

// OPT-IN diagnostic: keep the DIRECT prev screen live (never freeze it).
// Measurement motive (2026-08, Mac Safari glass): resident screen layers
// halved the per-flight onset present-skip, but the POP-returning screen
// still pays a layer creation + first raster — its freeze (display:none)
// destroys the layer regardless of any will-change, so the wake recreates
// it at flight start. Keeping only the direct prev live pre-serves its
// rasterized layer for the instant a pop needs it; DEEP screens keep
// freezing (the O(depth) storm protection stays intact). Cost: one extra
// live full-screen subtree at rest. Armed per session by a URL visit
// (?flemo-freeze=shallow / ?flemo-freeze=off), synced to the `flemo:freeze`
// storage key eagerly at module load; the (cached) read itself lives in
// diagnosticFlags.ts.
const syncShallowToggle = () => {
  try {
    if (typeof location === "undefined" || typeof sessionStorage === "undefined") return;
    if (/[?&]flemo-freeze=shallow\b/.test(location.search)) {
      sessionStorage.setItem("flemo:freeze", "shallow");
    } else if (/[?&]flemo-freeze=off\b/.test(location.search)) {
      sessionStorage.removeItem("flemo:freeze");
    }
  } catch {
    // Storage unavailable: the instrument simply stays off.
  }
};
syncShallowToggle();

export interface ScreenFreezeInput {
  isActive: boolean;
  isPrev: boolean;
  zIndex: number;
  index: number;
  status: NavigateStatus;
  dragStatus: "IDLE" | "PENDING";
  replaceTransitionStatus: "IDLE" | "PENDING";
}

// HOW a screen should freeze (kept mounted but display:none so it holds its
// state without painting). Three modes, because the freeze COMMIT has a cost
// and only one screen's freeze ever races the eye:
// - "immediate": a DEEP screen (below the direct prev). Nothing the eye can
//   see — it was already covered before this transition began — so it freezes
//   in the same commit that re-ranks it. Deferring these is what let a rapid
//   push storm accumulate 15-20 live full-screen layers (every new
//   transition re-armed the deferral, so no screen ever froze until the
//   storm ended): whole-app flicker and jank at depth.
// - "deferred": the JUST-COVERED direct prev at rest. Its freeze is the one
//   commit that would land on the convergence frames the eye still watches
//   (measured: ~0.2 dropped frames per flight), so the binding defers it
//   into a quiet window.
// - "live": a participant (the active screen, a transitioning prev, the
//   replace-flip guard) — must not freeze, and a frozen screen reaching this
//   mode must WAKE in the same commit (a pop destination).
// Framework-neutral; the binding renders the result.
export type ScreenFreezeMode = "live" | "deferred" | "immediate";

export function computeScreenFreezeMode(input: ScreenFreezeInput): ScreenFreezeMode {
  const deep =
    (input.isPrev && input.index - 2 <= input.zIndex && input.replaceTransitionStatus === "IDLE") ||
    (input.isPrev && input.index - 2 > input.zIndex);
  if (deep) return "immediate";
  const isTransitionCompleted = input.status === "COMPLETED" && input.dragStatus === "IDLE";
  if (!input.isActive && isTransitionCompleted) return shallowFreeze() ? "live" : "deferred";
  return "live";
}

// Boolean view of the mode — unchanged semantics for callers that only ask
// "should this screen be frozen at all".
export default function computeScreenFreeze(input: ScreenFreezeInput): boolean {
  return computeScreenFreezeMode(input) !== "live";
}
