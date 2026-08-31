import { detectBlinkEngine } from "@platform/engineProbes";

// ─────────────────────────────────────────────────────────────────────────────
// Genuine-steady-60Hz verdict for the DESKTOP Blink profile.
//
// It no longer routes anything (Blink runs the compiled tier everywhere since
// 2026-08-19); the verdict now selects desktop DEFAULTS only — see
// steadySixtyDesktopProfile below. The reasoning that produced it is kept in
// full because the measurement is what makes those defaults defensible, and
// because it records why an idle cadence probe must never gate anything.
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
// The first flight of a session therefore always runs unverified, and a
// machine's worst case is two flights before the profile latches. When this
// verdict still routed, that meant two compiled flights before the player
// took over; today it means two flights on the desktop DEFAULTS rather than
// the profile's.
// ─────────────────────────────────────────────────────────────────────────────

// Below this in-flight median the display is presenting faster than the
// player's per-frame main-thread write can survive. Mirrors the engine's
// COMPILED_TIER_MAX_INTERVAL_MS (createTransitionEngine.ts). Exported for
// the player's own cadence feed (it reports only high-refresh CANDIDATES —
// a mid-band median from its longer, noisier stream must not reset the
// streak the probe windows built).
export const HIGH_REFRESH_MAX_INTERVAL_MS = 12;
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

// MODULE STATE, for the life of the document. The verdict was persisted to
// `flemo:sixty` (sessionStorage) until 2026-08-31, so that a RELOAD did not
// re-run the two-flight warm-up; it went with every other `flemo:*` key when
// the diagnostic surface was removed from the shipped library. Client-side
// navigation keeps the verdict either way — only a hard reload starts the two
// flights over, which is the pre-2026-08-18 behavior.
let sawHighRefresh = false;
let sixtyStreak = 0;

// Whether this session could ever READ the verdict (see the note in
// reportInFlightCadence). SSR and jsdom report no touch surface, so both keep
// accumulating exactly as before.
const canAccumulateVerdict = (): boolean =>
  typeof navigator === "undefined" || (navigator.maxTouchPoints ?? 0) === 0;

// Feed one in-flight cadence median (RAW, unclamped — the learned-interval
// clamp in displayCadence would erase the 60-vs-default distinction).
// Called by the engine's display-interval probe during compiled flights, so
// the verdict only ever forms from measurements taken while a compositor
// animation had the panel at its true rate.
export const reportInFlightCadence = (rawMedianMs: number, rawMaxMs?: number): void => {
  if (!Number.isFinite(rawMedianMs) || rawMedianMs <= 0) return;
  // A TOUCH session can never consume this verdict (steadySixtyDesktopProfile
  // requires maxTouchPoints === 0), so it must not pay the streak bookkeeping
  // for one. The display probe that feeds this still runs there, because its
  // other output (learnedFrameIntervalMs) does reach touch Blink; only the
  // verdict stops accumulating.
  //
  // Touch-ness is the right guard because it cannot change within a session.
  // devicePixelRatio deliberately is NOT: a window dragged to another display
  // changes it mid-session, and gating accumulation on it would leave the
  // moved tab permanently unverified.
  if (!canAccumulateVerdict()) return;
  if (rawMedianMs < HIGH_REFRESH_MAX_INTERVAL_MS) {
    // The high latch demands a UNIFORM fast window, not merely a fast
    // median: a genuine 120Hz panel reports 8.3ms gaps wall to wall, while
    // a busy real-world tab recovering from a main-thread jam fires rAF in
    // CATCH-UP BURSTS (1-8ms gaps right after a long one) whose median can
    // dip below the threshold — device-reported 2026-08-18 as a tab stuck
    // on the compiled tier ("갈색") on a measured-60Hz display. A window
    // whose max gap betrays a stall is jam noise: ignore it entirely.
    if (rawMaxMs !== undefined && rawMaxMs > HIGH_REFRESH_MAX_INTERVAL_MS * 2) return;
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
  if (rawMedianMs < STEADY_SIXTY_MIN_MS) {
    sixtyStreak = 0;
  }
};

// The verified verdict alone (no environment gates) — exposed for the
// routing's own comment trail and the tests.
export const steadySixtyVerified = (): boolean =>
  !sawHighRefresh && sixtyStreak >= STEADY_SIXTY_FLIGHTS;

// The desktop-PROFILE predicate: a desktop (non-touch) Blink session on a
// HiDPI display whose in-flight cadence has verified steady-60.
//
// It gates DEFAULTS, never a driver: the render-settle gate and the
// unpainted-only image hold. It also gated the compositor warm-up's 60fps
// cadence video until that was deleted on 2026-08-31 — the video chased the
// browser-process present state the campaign had already concluded a page
// cannot reach, and paid a session-permanent decode for it. It
// once carried the name `steadySixtyPlayerEligible`, from the 2026-08-17 round
// that routed these sessions to the rAF player for its device-pixel snap; the
// 2026-08-18 live ladder settled desktop on the compiled tier unconditionally
// and the player was retired outright, so the name outlived its meaning by a
// long way.
export const steadySixtyDesktopProfile = (): boolean =>
  steadySixtyVerified() &&
  detectBlinkEngine() &&
  typeof navigator !== "undefined" &&
  navigator.maxTouchPoints === 0 &&
  typeof window !== "undefined" &&
  (window.devicePixelRatio || 1) >= STEADY_SIXTY_MIN_DPR;

/* v8 ignore next 4 -- test hook: the verdict is document-scoped module state. */
export const resetSteadySixtyForTests = (): void => {
  sawHighRefresh = false;
  sixtyStreak = 0;
};
