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

export const lowPowerCadenceActive = (): boolean => active;

/* v8 ignore next 5 -- test hook. */
export const resetLowPowerCadenceForTests = () => {
  active = false;
  probing = false;
};

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
  probeLowPowerCadence();
}
