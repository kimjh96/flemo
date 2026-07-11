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

export interface DriverPolicyStorage {
  read: () => string | null;
  write: (value: string) => void;
}

const STORAGE_KEY = "flemo:motion-driver";

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
  // Player run lifecycle: the registry reports gaps; the policy aggregates.
  beginRun: () => void;
  reportGap: (gapMs: number) => void;
  endRun: () => void;
  // Diagnostics (also consumed by tests).
  stats: () => { runGaps: number[]; strikes: number; demoted: boolean };
}

export const createDriverPolicy = (
  storage: DriverPolicyStorage = defaultStorage()
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
    playerAllowed: () => !demoted,
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
