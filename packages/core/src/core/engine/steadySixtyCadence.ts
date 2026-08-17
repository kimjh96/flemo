import { detectBlinkEngine } from "@core/engine/driverPolicy";

// ─────────────────────────────────────────────────────────────────────────────
// Genuine-steady-60Hz verdict for DESKTOP Blink routing.
//
// Desktop Blink defaulted to the compiled tier UNCONDITIONALLY because an idle
// cadence probe lies on exactly the machines the compiled tier must keep: an
// adaptive panel (ProMotion) idles at 60Hz and ramps to 120Hz the moment a
// compositor animation runs (measured: real Chrome, idle rAF 16.7ms median on
// the 120Hz panel), and at a ramped 8.3ms budget the player measurably cannot
// present (36% partial presents, PipelineReporter-traced — and partial
// presents are INVISIBLE to rAF timing, so no gap-based demotion would ever
// catch it).
//
// But the blanket rule also parked genuinely-fixed-60Hz HiDPI desktops on the
// compiled tier, whose fractional-phase bilinear resampling is the measured
// source of the convergence shimmer there — while the player with always-snap
// closes exactly that class (device-verified 2026-08-17, 4K@60Hz 2x external
// panels: `?driver=raf&snap=always` cleared the shimmer; snap `gate`/`hybrid`
// let it back in).
//
// The trustworthy reading is the one taken IN FLIGHT: the engine's
// display-interval probe samples rAF gaps while a compiled flight's compositor
// animation is running — the moment an adaptive panel shows its true rate —
// and the frame-pacing keepalive then holds the panel at that rate for the
// session. Session-scoped verdict, learned from those reports:
//
// - any in-flight median below the high-refresh threshold latches HIGH
//   permanently: a machine that CAN present fast must stay compiled;
// - two qualifying medians inside the steady-60 window verify SIXTY;
// - the ambiguous 12–14ms band between the thresholds resets the streak
//   (it could be either panel class — start over);
// - a SLOW median (>22ms — a loaded main thread mid-flight) is NEUTRAL:
//   it neither advances nor resets. A 30Hz power governor only ever
//   produces 33ms medians, so it can never accumulate the two qualifying
//   readings; a healthy 60Hz panel whose push medians ride a heavy mount
//   commit still verifies off its clean flights.
//
// The first flight of a session therefore always runs compiled (probing), and
// a machine's worst case is two compiled flights before the player takes
// over — mirroring the demotion machinery's session-start probing cost.
// ─────────────────────────────────────────────────────────────────────────────

// Below this in-flight median the display is presenting faster than the
// player's per-frame main-thread write can survive. Mirrors the engine's
// COMPILED_TIER_MAX_INTERVAL_MS (createTransitionEngine.ts).
const HIGH_REFRESH_MAX_INTERVAL_MS = 12;
// The steady-60 acceptance window: 14ms (~71Hz — generous headroom over an
// honest 16.7ms median) to 22ms (~45Hz — a momentarily loaded 60Hz panel
// still qualifies; a 30Hz governor's 33ms never does).
const STEADY_SIXTY_MIN_MS = 14;
const STEADY_SIXTY_MAX_MS = 22;
// Consecutive qualifying flights before the verdict flips.
const STEADY_SIXTY_FLIGHTS = 2;
// The player's HiDPI always-snap is the benefit that justifies the routing;
// at 1x there is no shimmer to fix and the compiled tier keeps its record.
const STEADY_SIXTY_MIN_DPR = 1.5;

let sawHighRefresh = false;
let sixtyStreak = 0;

// Feed one in-flight cadence median (RAW, unclamped — the learned-interval
// clamp in transitionPlayer would erase the 60-vs-default distinction).
// Called by the engine's display-interval probe during compiled flights, so
// the verdict only ever forms from measurements taken while a compositor
// animation had the panel at its true rate.
export const reportInFlightCadence = (rawMedianMs: number): void => {
  if (!Number.isFinite(rawMedianMs) || rawMedianMs <= 0) return;
  if (rawMedianMs < HIGH_REFRESH_MAX_INTERVAL_MS) {
    sawHighRefresh = true;
    sixtyStreak = 0;
    return;
  }
  if (rawMedianMs >= STEADY_SIXTY_MIN_MS && rawMedianMs <= STEADY_SIXTY_MAX_MS) {
    sixtyStreak = Math.min(STEADY_SIXTY_FLIGHTS, sixtyStreak + 1);
    return;
  }
  // The ambiguous 12-14ms band resets; a slow (>22ms) median is neutral —
  // see the header.
  if (rawMedianMs < STEADY_SIXTY_MIN_MS) sixtyStreak = 0;
};

// The verified verdict alone (no environment gates) — exposed for the
// routing's own comment trail and the tests.
export const steadySixtyVerified = (): boolean =>
  !sawHighRefresh && sixtyStreak >= STEADY_SIXTY_FLIGHTS;

// The full routing predicate: a desktop (non-touch) Blink session on a HiDPI
// display whose in-flight cadence has verified steady-60. Consulted by the
// engine's joinPlayer desktop gate AND by the settle-gate default (a
// main-thread player must not be born into the entering screen's mount
// commit — the render-settle gate is the same protection the touch tiers
// ship with).
export const steadySixtyPlayerEligible = (): boolean =>
  steadySixtyVerified() &&
  detectBlinkEngine() &&
  typeof navigator !== "undefined" &&
  navigator.maxTouchPoints === 0 &&
  typeof window !== "undefined" &&
  (window.devicePixelRatio || 1) >= STEADY_SIXTY_MIN_DPR;

/* v8 ignore next 4 -- test hook: the verdict is session-scoped module state. */
export const resetSteadySixtyForTests = (): void => {
  sawHighRefresh = false;
  sixtyStreak = 0;
};
