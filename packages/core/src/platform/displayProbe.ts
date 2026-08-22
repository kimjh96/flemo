import { reportDisplayIntervalMs } from "@platform/displayCadence";

const noop = () => {};
import { reportInFlightCadence } from "@platform/steadySixtyCadence";

// THE IN-FLIGHT DISPLAY PROBE, and the frame-pacing keepalive beside it.
//
// Both exist because a compositor-driven flight leaves the main thread idle,
// and an idle main thread tells you two lies: an adaptive panel reports its
// idle rate rather than the rate it is presenting at, and Chrome paces its
// macOS ProMotion presentation unevenly when nothing is asking for frames.
//
// So this module runs rAF during flights — once to MEASURE (the probe, whose
// median feeds the learned cadence and the steady-60 verdict) and once to
// simply EXIST (the keepalive, whose callback does nothing at all).
//
// It lives beside the cadence state it feeds rather than inside the engine:
// the engine's only interest is arming it at the right moment.

// landingGovernor.ts): 12ms sits between 120Hz (8.3) and 90Hz (11.1) on one
// side and 60Hz (16.7) on the other — and a power-throttled presentation (30Hz
// measured on battery) never qualifies.
export const COMPILED_TIER_MAX_INTERVAL_MS = 12;

// Frame-pacing keepalive for Blink's COMPILED tier. A compositor-driven flight
// leaves the main thread idle, and Chrome then paces its macOS ProMotion
// presentation UNEVENLY — video-measured at 120fps, a full-screen slide
// drops/duplicates frames mid-flight (a near-zero inter-frame delta followed
// by a double-step) and the eye reads it as trembling, which rAF timing on the
// main thread cannot see because the animation's value function is smooth.
// Device-confirmed: an empty `requestAnimationFrame` loop running for the
// flight visibly steadies the cadence (the compositor keeps presenting on every
// vsync while a frame source is live). The callback does nothing — its mere
// existence is the fix. Ref-counted so overlapping flights share one loop, and
// armed only for compiled Blink flights (WebKit and the rAF player already keep
// a frame source alive).
// CONTINUOUS once started — never stopped for the rest of the page session.
// A per-flight loop lets Chrome re-ramp its macOS ProMotion panel from idle
// 60Hz on every deliberate navigation (a cold opening), which is why an
// on/off loop barely helped while the device A/B — a NEVER-stopping rAF — did.
// The callback does nothing; a live frame source is the whole point, and it
// costs a single empty rAF. Armed lazily on the first compiled Blink flight
// (so it never runs before the app navigates) and then kept warm forever.
let keepaliveHandle: number | null = null;
const keepaliveTick = () => {
  /* v8 ignore next 2 -- the loop only runs where rAF existed to start it; the
     re-check covers an environment that removes it mid-session. */
  keepaliveHandle =
    typeof requestAnimationFrame === "function" ? requestAnimationFrame(keepaliveTick) : null;
};
export const armFramePacingKeepalive = (): (() => void) => {
  if (keepaliveHandle === null && typeof requestAnimationFrame === "function") {
    keepaliveHandle = requestAnimationFrame(keepaliveTick);
  }
  // No release: the frame source stays warm for the session so the NEXT
  // deliberate navigation opens on an already-120Hz panel.
  return noop;
};

// Re-sample the display cadence while flights run WITHOUT a player (the
// routed-compiled state has no player to learn from): six rAF gaps, median
// reported back to the player module. One probe at a time.
// (2026-08-12 note: a retrying, slow-vouching variant of this probe powered
// an iOS Low Power Mode routing experiment — LPM caps rAF at ~30Hz while
// the compositor presents at panel rate, so slides were routed compiled
// there. Device-revoked same day: real pushes exposed the compiled tier's
// unfixable release-commit clock aging as a WORSE whoosh than the player's
// 30fps even-stepping, and the slow-vouched learned interval destabilized
// Blink's governed-easing parameters mid-session. The 30fps even-stepped
// player IS the correct response to an OS power policy.)
let displayProbeActive = false;
// Bumped on every arm AND every cancel; a tick whose generation is stale
// stops scheduling and reports nothing. Cancellation matters on adaptive
// panels: a probe outliving its compiled flight measures the IDLE clock,
// which reads ~60Hz there — exactly the value that must never feed the
// steady-60 verdict (in-flight is the only honest window, see
// steadySixtyCadence.ts).
let displayProbeGeneration = 0;
export const cancelDisplayIntervalProbe = () => {
  if (!displayProbeActive) return;
  displayProbeGeneration += 1;
  displayProbeActive = false;
};
// Module state outlives a test file's cases (a probe armed by one test would
// block every later arm); same pattern as diagnosticFlags' reset exports.
export const resetDisplayProbeForTests = () => {
  displayProbeGeneration += 1;
  displayProbeActive = false;
};
// Two skipped warm-up gaps + an 8-gap median: the probe arms in the same
// commit that releases the flight, so its FIRST gaps ride the entering
// screen's mount-commit stall — measured on the playground push, the raw
// 6-gap median read 30ms+ on a healthy 60Hz panel and poisoned every
// cadence consumer. The warm-up lets the commit clear while the compositor
// animation (the panel-rate anchor this probe exists to observe) keeps
// running; the wider window makes the median robust to one or two stragglers.
const DISPLAY_PROBE_WARMUP_TICKS = 2;
const DISPLAY_PROBE_GAPS = 8;
export const armDisplayIntervalProbe = () => {
  if (displayProbeActive || typeof requestAnimationFrame !== "function") return;
  displayProbeActive = true;
  const generation = ++displayProbeGeneration;
  const gaps: number[] = [];
  let warmup = DISPLAY_PROBE_WARMUP_TICKS;
  let lastTick: number | null = null;
  const tick = (time: number) => {
    if (generation !== displayProbeGeneration) return;
    if (lastTick !== null) {
      if (warmup > 0) warmup -= 1;
      else gaps.push(time - lastTick);
    }
    lastTick = time;
    if (gaps.length < DISPLAY_PROBE_GAPS) {
      requestAnimationFrame(tick);
      return;
    }
    displayProbeActive = false;
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    reportDisplayIntervalMs(median);
    // The RAW median additionally feeds the steady-60 verdict (the learned
    // interval above is clamped to the 60Hz nominal, which would erase the
    // 60-vs-unmeasured distinction the verdict needs). This probe only runs
    // during compiled flights — a compositor animation is live, so an
    // adaptive panel is at its true rate (see steadySixtyCadence.ts). The
    // window's max gap rides along so the verdict can reject jam-noise
    // windows (rAF catch-up bursts fake a fast median).
    reportInFlightCadence(median, sorted[sorted.length - 1]!);
  };
  requestAnimationFrame(tick);
};
