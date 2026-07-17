// Evidence-based motion-driver policy.
//
// The rAF player's failure mode (main-thread stalls skipping its frames) is
// SELF-MEASURABLE — its own frame gaps — while the compositor path's failure
// (missed presentation under raster load) is invisible to JS entirely, which
// is why the library defaults to the player and demotes on evidence, never
// the other way around. A device whose main thread chronically starves the
// player (long consumer commits mid-transition on low-end hardware) earns a
// persisted demotion to the compiled-CSS animation path, which is preserved
// intact as the fallback driver. No consumer API: the library observes and
// decides.
//
// The default is ENGINE-SCOPED. The compositor defect the player routes
// around was measured on Blink specifically; WebKit's compositor never showed
// it (its historical failure — content-update stalls — is solved in the
// hold/park/decode pipeline), while WebKit's mobile main threads are exactly
// where a main-thread player starves, eye-confirmed janky on Safari and worse
// on iOS. So the player is the default only where its evidence lives; on
// every other engine the compiled compositor paths stay in charge, with the
// measured policy and the force key still supreme on both sides.

export interface DriverPolicyStorage {
  read: () => string | null;
  write: (value: string) => void;
}

const STORAGE_KEY = "flemo:motion-driver";

// Diagnostic hard override for field debugging (same spirit as
// window.__flemoPlayerGaps): "css" pins the compiled-CSS path, "raf" pins the
// player, bypassing measurement, strikes, and probation entirely. Read live on
// every decision so a DevTools toggle takes effect on the next transition.
// Not a consumer API — intentionally undocumented.
const FORCE_KEY = "flemo:motion-driver-force";

// Warn once per session while the pin is active: a forgotten force key reads
// as a mysterious cross-site perf regression (it pins EVERY transition), so
// it must never be silent.
let warnedForcedDriver = false;

// Pure read of the diagnostic pin — no warning side effect, so predicates that
// consult it every transition (driverPolicy.pinned) don't have to launder the
// warn-once through their call path.
const readForceKey = (): "css" | "raf" | null => {
  try {
    if (typeof localStorage === "undefined") return null;
    const value = localStorage.getItem(FORCE_KEY);
    return value === "css" || value === "raf" ? value : null;
  } catch {
    return null;
  }
};

const readForcedDriver = (): "css" | "raf" | null => {
  const value = readForceKey();
  if (value && !warnedForcedDriver && typeof console !== "undefined") {
    warnedForcedDriver = true;
    // The console IS the destination here: this fires only while a
    // deliberately-set diagnostic key is active, and its whole purpose is
    // that a forgotten pin can never be silent.
    // eslint-disable-next-line no-console
    console.warn(
      `[flemo] motion driver pinned to "${value}" via localStorage ${FORCE_KEY}; ` +
        "remove the key to restore automatic selection."
    );
  }
  return value;
};

const defaultStorage = (): DriverPolicyStorage => ({
  read: () => {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage unavailable (private mode, embedder policy): the decision
      // simply lives for this session only.
    }
  }
});

// A frame arriving later than ~1.8 vsyncs (60Hz) means at least one missed
// frame. Transitions with several of these read as visibly stuttering.
const LONG_GAP_MS = 30;
// Missed-frame count that marks one transition as stalled. Two, not one — a
// single long gap can be GC noise, while two in one 0.6s window means real
// main-thread pressure (measured: an 80ms mid-transition task produces a
// ~65ms gap; two of them is exactly the chronic-commit profile where the
// compositor path serves that device better).
const STALLED_RUN_THRESHOLD = 2;
// Stalled transitions before the device earns the persisted demotion. Two,
// not one: a single stall can be a cold-start artifact (first navigation
// compiling code, warming caches).
const DEMOTION_STRIKES = 2;

export interface DriverPolicy {
  // Whether the rAF player may drive motion on this device.
  playerAllowed: () => boolean;
  // Whether a diagnostic hard pin (the FORCE_KEY, "css" or "raf") is active.
  // The pin bypasses every AUTOMATIC driver decision — measurement, strikes,
  // probation, AND the engine's per-transition shell-first takeover — so a
  // field debugger can force either path unconditionally and reproduce its
  // behavior (including the diseased mid-flight snap on the player). The
  // engine consults this so its takeover yields to the pin, exactly as the
  // device-demotion policy already does. Read live, so a DevTools toggle takes
  // effect on the next transition.
  pinned: () => boolean;
  // Player run lifecycle: the registry reports gaps; the policy aggregates.
  beginRun: () => void;
  reportGap: (gapMs: number) => void;
  endRun: () => void;
  // Diagnostics (also consumed by tests).
  stats: () => { runGaps: number[]; strikes: number; demoted: boolean };
}

// Engine probe, not a brand sniff: navigator.userAgentData ships with Blink
// and nothing else — including iOS Chrome, which is WebKit underneath and
// correctly reads as non-Blink here. Blink builds too old to have it predate
// the measured defect profile and are better served by the compositor anyway.
export const detectBlinkEngine = (): boolean =>
  typeof navigator !== "undefined" && !!(navigator as { userAgentData?: unknown }).userAgentData;

export const createDriverPolicy = (
  storage: DriverPolicyStorage = defaultStorage(),
  playerByDefault: boolean = detectBlinkEngine()
): DriverPolicy => {
  // A persisted demotion is PROBATION, not a life sentence: each new session
  // the player gets one probe transition. A clean probe clears the record —
  // so one bad day (a background-noise stall streak) can't permanently
  // downgrade a healthy device — while a stalling probe re-confirms the
  // demotion for the rest of the session.
  let demoted = storage.read() === "css";
  let probing = demoted;
  if (demoted) demoted = false;

  let strikes = 0;
  let runLongGaps = 0;
  let runGaps: number[] = [];

  return {
    playerAllowed: () => {
      const forced = readForcedDriver();
      if (forced) return forced === "raf";
      return playerByDefault && !demoted;
    },
    pinned: () => readForceKey() !== null,
    beginRun: () => {
      runLongGaps = 0;
      runGaps = [];
    },
    reportGap: (gapMs) => {
      runGaps.push(gapMs);
      if (gapMs >= LONG_GAP_MS) runLongGaps += 1;
    },
    endRun: () => {
      const stalled = runLongGaps >= STALLED_RUN_THRESHOLD;
      if (probing) {
        probing = false;
        if (stalled) {
          demoted = true;
        } else {
          storage.write("raf");
        }
        return;
      }
      if (stalled) {
        strikes += 1;
        if (strikes >= DEMOTION_STRIKES && !demoted) {
          demoted = true;
          storage.write("css");
        }
      }
    },
    stats: () => ({ runGaps: [...runGaps], strikes, demoted })
  };
};

const driverPolicy = createDriverPolicy();

export default driverPolicy;
