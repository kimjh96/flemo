import { detectBlinkEngine } from "@core/engine/driverPolicy";

// iOS Low Power Mode detection, ISOLATED from the player's learned interval.
//
// LPM caps requestAnimationFrame at ~30Hz while the compositor keeps
// presenting at the panel rate (device A/B 2026-08-12: a CSS slide visibly
// smoother than the identical rAF-driven one under LPM) — the exact split
// native apps exploit, which is why UIKit transitions stay smooth there.
// Under LPM the rAF-driven player can only produce half the frames, so
// slides route to the compiled tier while this flag is up (see joinPlayer),
// WITH the birth anchor + stall watcher armed. Trajectory-verified: the
// bare routing's pushes opened with a 360-550 device-px first step after a
// 68-95ms release gap (the swallowed opening), while the protected stack's
// measured flight opened on the authored ramp (1284→1213→1094…).
//
// The detection state is deliberately ITS OWN: an earlier variant vouched
// the slow cadence into the player's shared learned interval, and a
// battery-throttled Blink session (regular ~33ms rAF looks identical) then
// fed the slow value into Blink's governed-easing parameters mid-session —
// visible curve breakage. This module never runs on Blink and never touches
// the learned interval.
//
// Signature: a REGULAR 28-42ms rAF cluster (the cap applies at idle, so a
// calm window reads it; genuine starvation is irregular and stays
// inconclusive). Inconclusive windows retry. COLD START is covered twice:
// the first probe fires at MODULE EVALUATION (hundreds of ms before any
// engine exists), and the last verdict PERSISTS in sessionStorage — a
// reload inside an LPM session arms optimistically from the stored flag and
// the first conclusive probe corrects it either way. A regular fast cluster
// clears the flag (the recovery path once LPM lifts; probes re-arm on
// visibility return — LPM commonly toggles while backgrounded — and per
// routed flight).

const SLOW_BAND_MIN_MS = 28;
const SLOW_BAND_MAX_MS = 42;
const SLOW_BAND_SPREAD_MS = 8;
const FAST_MAX_MS = 20;
const PROBE_SAMPLES = 6;
const PROBE_RETRY_MS = 400;
const PROBE_MAX_ATTEMPTS = 8;
const PERSIST_KEY = "flemo:lpm";

const eligible = (): boolean =>
  !detectBlinkEngine() &&
  typeof navigator !== "undefined" &&
  navigator.maxTouchPoints > 0 &&
  typeof requestAnimationFrame === "function";

const readPersisted = (): boolean => {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(PERSIST_KEY) === "1";
  } catch {
    return false;
  }
};

const persist = (value: boolean): void => {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(PERSIST_KEY, value ? "1" : "0");
    }
  } catch {
    // Storage unavailable: the session simply re-detects from scratch.
  }
};

let active = false;
let probing = false;
let lifecycleArmed = false;
let learnedFrameMs: number | null = null;

// CONTINUOUS cadence monitor — the readiness fix for the FIRST flight. The
// discrete probe above needs a clean 6-sample window and RETRIES 400ms apart
// when the window is noisy; app bootstrap and a rapid tap both starve it, so
// its verdict routinely isn't ready when the very first navigation's driver is
// chosen — and under LPM that first flight then runs on the 30Hz rAF player
// (device: "저전력모드에서만 문제"). This monitor runs from module load and
// keeps a rolling window of raw rAF gaps, so a fresh verdict is ALWAYS
// available the instant a flight asks — no clean window required. It never
// produces a false LPM on a fast-but-loaded device: genuine starvation is
// IRREGULAR (16-100ms jitter), while the LPM cap is a REGULAR ~33ms cluster,
// so the read demands both a slow-band median AND low spread.
const MONITOR_WINDOW = 12;
const MONITOR_MIN_SAMPLES = 8;
const monitorGaps: number[] = [];
let monitorLastTs: number | null = null;
let monitorArmed = false;
// LATCHED verdict. The window is only TRUSTED when it is REGULAR (low spread) —
// that is an IDLE window, and idle cleanly separates 16ms (normal) from ~33ms
// (LPM). A jittery window is a NAVIGATION in progress (the very moment a flight
// asks) and must NOT overwrite the verdict, or the read fails exactly when it's
// needed (device: lpm detected-and-persisted, yet the flight still chose the
// 30Hz player because the read at flight time saw navigation jitter). So the
// monitor latches the last CLEAN idle read and holds it across the jitter.
let monitorLatchLpm = false;
let monitorHasLatch = false;
const armContinuousCadenceMonitor = (): void => {
  if (monitorArmed || !eligible()) return;
  monitorArmed = true;
  const tick = (ts: number): void => {
    if (monitorLastTs !== null) {
      monitorGaps.push(ts - monitorLastTs);
      if (monitorGaps.length > MONITOR_WINDOW) monitorGaps.shift();
      if (monitorGaps.length >= MONITOR_MIN_SAMPLES) {
        const sorted = [...monitorGaps].sort((a, b) => a - b);
        const trimmed = sorted.slice(1, sorted.length - 1);
        const median = trimmed[trimmed.length >> 1]!;
        const spread = trimmed[trimmed.length - 1]! - trimmed[0]!;
        // Only a REGULAR window (idle) updates the latch; a jittery window
        // (a navigation, GC, or load work) leaves the last idle verdict intact.
        if (spread <= SLOW_BAND_SPREAD_MS) {
          monitorLatchLpm = median >= SLOW_BAND_MIN_MS && median <= SLOW_BAND_MAX_MS;
          monitorHasLatch = true;
        }
      }
    }
    monitorLastTs = ts;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

export const lowPowerCadenceActive = (): boolean => active || (monitorHasLatch && monitorLatchLpm);

// The touch-WebKit COMPILED-GOVERNED default. LPM detection proved the compiled
// tier + governed head (data-flemo-lpm: flat head, front-softened easing, fade
// stretch) is the smooth, un-swallowed opening on touch WebKit — and it holds
// at the panel rate whether or not the device is actually in Low Power Mode
// (device-confirmed 2026-08 on a 60Hz iPhone with LPM off). So the whole
// governed-compiled treatment is the DEFAULT for EVERY touch-WebKit flight, not
// only detected-LPM ones: routing to the compiled tier, raising data-flemo-lpm,
// and the synchronous atomic release all key off this. `eligible()` is exactly
// non-Blink + touch. lowPowerFrameIntervalMs deliberately stays LPM-only — it
// must never assert a 30Hz cadence on a 60Hz panel.
export const governedCompiledActive = (): boolean => eligible();

// The measured LPM frame interval (median of the last conclusive slow
// cluster), for callers that predict pipeline latency from the cadence —
// null until a slow cluster has actually been measured this session.
export const lowPowerFrameIntervalMs = (): number | null => (active ? learnedFrameMs : null);

/* v8 ignore next 5 -- test hook. */
export const resetLowPowerCadenceForTests = () => {
  active = false;
  probing = false;
  learnedFrameMs = null;
};

// The release-latency ledger that used to live here (flemo:lat, fed by
// lpmReleaseLatencyProbe) was RETIRED 2026-08-19: the probe ran on every
// LPM-supervised flight and persisted a session-worst value that no
// production code ever read — the birth hold is sized from the static
// LPM_HEAD_MS table instead. It cost an observer per flight on the weakest
// devices in the matrix, and a stale flemo:lat seed had already neutralized
// a pessimistic branch mid-campaign once (docs/diagnostics.md pitfalls).
// If an adaptive hold is attempted again, size it from a reader that exists
// before landing the writer.

export const probeLowPowerCadence = (attempt = 0): void => {
  if (probing || !eligible()) return;
  probing = true;
  const gaps: number[] = [];
  let lastTick: number | null = null;
  const tick = (time: number) => {
    if (lastTick !== null) gaps.push(time - lastTick);
    lastTick = time;
    if (gaps.length < PROBE_SAMPLES) {
      requestAnimationFrame(tick);
      return;
    }
    probing = false;
    const sorted = [...gaps].sort((a, b) => a - b);
    // Judge with the single worst sample dropped: one GC blip must not blind
    // the detection.
    const core = sorted.slice(0, sorted.length - 1);
    const regularSlow =
      core[0]! >= SLOW_BAND_MIN_MS &&
      core[core.length - 1]! <= SLOW_BAND_MAX_MS &&
      core[core.length - 1]! - core[0]! <= SLOW_BAND_SPREAD_MS;
    const regularFast = core[core.length - 1]! <= FAST_MAX_MS;
    if (regularSlow || regularFast) {
      active = regularSlow;
      if (regularSlow) learnedFrameMs = core[Math.floor(core.length / 2)]!;
      persist(active);
      return;
    }
    /* v8 ignore next 3 -- setTimeout exists in every runtime under test. */
    if (attempt + 1 < PROBE_MAX_ATTEMPTS && typeof setTimeout === "function") {
      setTimeout(() => probeLowPowerCadence(attempt + 1), PROBE_RETRY_MS);
    }
  };
  requestAnimationFrame(tick);
};

// Boot + resume sampling: the routing must know the cadence BEFORE the first
// flight, and LPM commonly toggles while the app is backgrounded.
export const armLowPowerCadenceLifecycle = (): void => {
  armContinuousCadenceMonitor();
  probeLowPowerCadence();
  if (
    lifecycleArmed ||
    typeof document === "undefined" ||
    typeof document.addEventListener !== "function"
  ) {
    return;
  }
  lifecycleArmed = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") probeLowPowerCadence();
  });
};

// COLD START, at module evaluation: seed from the persisted verdict (a
// reload inside an LPM session must not pay one 30fps flight to re-learn
// what the last page load already measured) and fire the first probe now —
// hundreds of milliseconds before any engine or React tree exists.
if (eligible()) {
  active = readPersisted();
  armContinuousCadenceMonitor();
  probeLowPowerCadence();
}
