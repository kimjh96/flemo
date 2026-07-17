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

const readForcedDriver = (): "css" | "raf" | null => {
  try {
    if (typeof localStorage === "undefined") return null;
    const value = localStorage.getItem(FORCE_KEY);
    if (value !== "css" && value !== "raf") return null;
    if (!warnedForcedDriver && typeof console !== "undefined") {
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
  } catch {
    return null;
  }
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
  // The active diagnostic pin (localStorage force key), or null. A pin means
  // "this exact driver, no automatic decisions" — the player registry reads it
  // to skip the health-gated takeover probe when pinned to "raf".
  pinnedDriver: () => "css" | "raf" | null;
  // Player run lifecycle: the registry reports gaps; the policy aggregates.
  beginRun: () => void;
  reportGap: (gapMs: number) => void;
  endRun: () => void;
  // Diagnostics (also consumed by tests).
  stats: () => { runGaps: number[]; strikes: number; demoted: boolean };
}

// Engine probe, not a brand sniff: navigator.userAgentData ships with Blink
// and nothing else — including iOS Chrome, which is WebKit underneath and
// correctly reads as non-Blink here. Kept for diagnostics; the DEFAULT driver
// no longer branches on it (see below).
export const detectBlinkEngine = (): boolean =>
  typeof navigator !== "undefined" && !!(navigator as { userAgentData?: unknown }).userAgentData;

// The COMPOSITOR (compiled CSS) is the default screen-transition driver on
// EVERY engine. The rAF player was Blink's default for a while (it routes
// around a measured compositor judder on specific hardware), but any
// main-thread driver shares its thread with the consumer's work — and a real
// app's transition window routinely carries a query-refetch or suspense data
// commit. Measured on production under 20x CPU throttle: the player collapsed
// each 150ms tab fade into 1-2 video frames (stagger/snap), a takeover health
// probe could not help (bursty load passes the probe then blocks — a probe
// certifies only the past), while the compositor played every fade ON TIME
// through 300ms main-thread stalls. Short transitions leave no room to
// recover: one mid-flight block outlasts the remainder. So the player is now
// an explicitly-pinned tier (`flemo:motion-driver-force = "raf"`) for
// judder-afflicted setups, plus embedders that opt in programmatically — both
// of which keep the demotion machinery and the takeover health gate.
export const createDriverPolicy = (
  storage: DriverPolicyStorage = defaultStorage(),
  playerByDefault: boolean = false
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
    pinnedDriver: () => readForcedDriver(),
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
