// Evidence-based motion-driver policy, scoped per rendering engine.
//
// BLINK: the COMPILED COMPOSITOR path drives; the rAF player is a diagnostic
// tier behind the force pin. Two pixel-level measurements settled this, both
// taken on real Chrome with per-frame screencast diffing:
// - Deceleration tail: the player's px-snapped inline writes move less than
//   1px per frame near rest, so the presented frames alternate hold/1px-step
//   (measured as ~0 / ~68k changed pixels, alternating) — a visible shiver.
//   The compiled path on translate3d keyframes decays monotonically to rest.
//   The Blink 2D-transform judder the player was ORIGINALLY built to route
//   around disappeared when the keyframe compiler moved every translation to
//   translate3d (direct texture-filtered compositing).
// - Main-thread churn: under 20x CPU throttle a real app's transition window
//   (query refetch + suspense commits) collapsed player-driven 150ms fades
//   into 1-2 presented frames, while Blink's compositor played every fade on
//   time through 300ms stalls.
//
// NON-BLINK: the PLAYER drives. The Chrome measurements above do not
// transfer, because WebKit presents these compiled screen animations FROM
// THE MAIN THREAD — proven on device glass (iPhone Safari screen recording,
// per-frame pixel classification): a refetch commit landing in a tab fade's
// tail froze the pixels at ~60% presented progress for ~80ms while the
// animation clock ran past its end, then the fill snapped the landed screen
// to full contrast — the reported whole-screen blink, on first entry and
// re-entry alike. A wall-clocked CSS animation structurally cannot survive
// that: the block eats its remaining span. The player shares the same main
// thread, so the same block freezes it identically — but its re-anchoring
// resumes FROM THE FREEZE and plays the remainder, delayed-but-complete
// instead of jumped (device-verified: blink gone, overall smoother). The
// demotion machinery is Blink-thinking ("the compositor serves that device
// better") and therefore never applies where the compiled path doesn't
// composite — see `demotable`.
//
// There is deliberately NO automatic driver switching, and none mid-flight:
// the two paths have different clocks, easing evaluation, and write paths, so
// any handoff during motion risks a visible seam. The pin picks one driver
// for the whole session; the demotion machinery still guards a force-pinned
// player on a chronically-starved Blink device.

export interface DriverPolicyStorage {
  read: () => string | null;
  write: (value: string) => void;
}

const STORAGE_KEY = "flemo:motion-driver";

// Diagnostic hard override for field debugging (same spirit as
// window.__flemoPlayerGaps): "css@<epoch-ms>" pins the compiled-CSS path,
// "raf@<epoch-ms>" pins the player, bypassing measurement, strikes, and
// probation entirely. Read live on every decision so a DevTools toggle takes
// effect on the next transition. Not a consumer API — intentionally
// undocumented. SESSION storage AND a freshness stamp, both learned the hard
// way: the pin once lived in localStorage, where one forgotten toggle
// silently pinned every future session; moved to sessionStorage, it STILL
// outlived its debugging session, because mobile tab restoration resurrects
// sessionStorage across days — a stale plain "raf" pin on a restored Safari
// tab reproduced the player's whole delay/mid-start profile on every tab
// switch while a pristine private window ran clean. A pin now expires after
// FORCE_PIN_TTL_MS, and anything unstamped or stale is REMOVED on sight so
// an old profile self-heals on its next decision.
const FORCE_KEY = "flemo:motion-driver-force";
export const FORCE_PIN_TTL_MS = 24 * 60 * 60 * 1000;

// Warn once per session while the pin is active: a forgotten force key reads
// as a mysterious cross-site perf regression (it pins EVERY transition), so
// it must never be silent.
let warnedForcedDriver = false;

const readForcedDriver = (): "css" | "raf" | null => {
  try {
    // Strip the legacy localStorage pin (see FORCE_KEY note) on every read:
    // never honored, only removed, so an old profile self-heals on its next
    // decision even if a stale tab rewrites it.
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(FORCE_KEY);
    } catch {
      // Storage unavailable: nothing to heal.
    }
    if (typeof sessionStorage === "undefined") return null;
    const value = sessionStorage.getItem(FORCE_KEY);
    if (value === null) return null;
    const [driver, stamp] = value.split("@");
    const stampMs = Number(stamp);
    const fresh =
      (driver === "css" || driver === "raf") &&
      stamp !== undefined &&
      Number.isFinite(stampMs) &&
      Math.abs(Date.now() - stampMs) < FORCE_PIN_TTL_MS;
    if (!fresh) {
      // Unstamped (legacy plain "raf"/"css"), malformed, or expired: never
      // honored, only removed.
      sessionStorage.removeItem(FORCE_KEY);
      return null;
    }
    if (!warnedForcedDriver && typeof console !== "undefined") {
      warnedForcedDriver = true;
      // The console IS the destination here: this fires only while a
      // deliberately-set diagnostic key is active, and its whole purpose is
      // that a forgotten pin can never be silent.
      // eslint-disable-next-line no-console
      console.warn(
        `[flemo] motion driver pinned to "${driver}" via sessionStorage ${FORCE_KEY}; ` +
          "remove the key to restore automatic selection (pins expire after 24h)."
      );
    }
    return driver as "css" | "raf";
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
  // Player run lifecycle: the registry reports gaps; the policy aggregates.
  beginRun: () => void;
  reportGap: (gapMs: number) => void;
  endRun: () => void;
  // Diagnostics (also consumed by tests).
  stats: () => { runGaps: number[]; strikes: number; demoted: boolean };
}

// Engine probe, not a brand sniff: navigator.userAgentData ships with Blink
// and nothing else — including iOS Chrome, which is WebKit underneath and
// correctly reads as non-Blink here. The DEFAULT driver branches on it (see
// the file header): compiled compositor on Blink, player elsewhere.
export const detectBlinkEngine = (): boolean =>
  typeof navigator !== "undefined" && !!(navigator as { userAgentData?: unknown }).userAgentData;

export const createDriverPolicy = (
  storage: DriverPolicyStorage = defaultStorage(),
  playerByDefault: boolean = false,
  // Whether the stall accounting may demote the player to the compiled path.
  // Only meaningful where the compiled path actually COMPOSITES (Blink): on
  // engines that present it from the main thread, "demoting" swaps a
  // freeze-and-continue driver for a freeze-and-jump one — strictly worse on
  // exactly the starved devices the demotion targets. Gap stats keep
  // accumulating for diagnostics either way.
  demotable: boolean = true
): DriverPolicy => {
  // A persisted demotion is PROBATION, not a life sentence: each new session
  // the player gets one probe transition. A clean probe clears the record —
  // so one bad day (a background-noise stall streak) can't permanently
  // downgrade a healthy device — while a stalling probe re-confirms the
  // demotion for the rest of the session. A non-demotable policy also
  // IGNORES any persisted record (an older version may have written one).
  let demoted = demotable && storage.read() === "css";
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
      if (stalled) strikes += 1;
      if (!demotable) return;
      if (probing) {
        probing = false;
        if (stalled) {
          demoted = true;
        } else {
          storage.write("raf");
        }
        return;
      }
      if (stalled && strikes >= DEMOTION_STRIKES && !demoted) {
        demoted = true;
        storage.write("css");
      }
    },
    stats: () => ({ runGaps: [...runGaps], strikes, demoted })
  };
};

// Engine-scoped default (see the file header): Blink runs the compiled
// compositor path; everything else runs the player, non-demotable — the
// compiled path is the freeze-and-jump tier there, never a refuge.
const driverPolicy = detectBlinkEngine()
  ? createDriverPolicy()
  : createDriverPolicy(defaultStorage(), true, false);

export default driverPolicy;
