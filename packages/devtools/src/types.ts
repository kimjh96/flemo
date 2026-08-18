// Report schema for the flemo flight recorder.
//
// Design goal: an agent (or human) reading ONE serialized FlemoReport cold —
// no access to the page, no follow-up questions to the user — can reconstruct
// what happened: which navigations ran, on which driver tier, how they paced,
// what stalled them, what residue they left, which debug overrides were
// active, and which observation traps invalidate visual reports from the
// session. Every field is plain JSON-serializable data.

/** How a flight's motion was driven, judged from DOM signatures alone. */
export type FlightDriver =
  // The rAF transition player: inline `animation` suppression on the screen
  // scope plus per-frame advancing inline transform/opacity.
  | "player"
  // The compiled-CSS tier: a running CSSAnimation whose name starts with
  // "flemo-" (compositor- or main-thread-presented, engine-dependent).
  | "compiled"
  // Both signatures observed across the flight's participants.
  | "mixed"
  // Neither signature observed (zero-duration flight, or the sampler attached
  // after the motion ended).
  | "unknown";

/** Navigation kind, from the transitional `data-flemo-status` value. */
export type FlightKind = "PUSH" | "POP" | "REPLACE";

/** A single moment on both clocks: monotonic performance.now + wall clock. */
export interface FlightTimestamp {
  /** performance.now() milliseconds (same clock as longTasks/frame gaps). */
  ms: number;
  /** ISO-8601 wall-clock time, for correlating with external logs. */
  iso: string;
}

/** Elements that carried transitional flemo attributes during the flight. */
export interface FlightParticipants {
  screens: number;
  bars: number;
  decorators: number;
  parts: number;
}

/** The animation-hold observed on the flight (data-flemo-anim-hold). */
export interface FlightHolds {
  /** "park-under" | "park-over" | "park" | "true", or null if no hold ran. */
  kind: string | null;
  /**
   * Milliseconds after t0 at which the LAST hold released (every
   * transitional screen's data-flemo-anim-hold at "false"). Null when no
   * hold ran — or when a hold never released (then the whole flight is the
   * held phase).
   */
  releasedAtMs: number | null;
}

/** Frame-gap stats for one phase of a flight (held vs released). */
export interface FramePhaseStats {
  count: number;
  medianGapMs: number;
  maxGapMs: number;
  over30Count: number;
}

/**
 * Stats over the recorder's own rAF-observed frame gaps during the flight,
 * segmented by the anim-hold phase. The engine deliberately absorbs heavy
 * commits INTO the hold (the screen is posed, not moving), so a gap during
 * `held` is the engine working as designed — only `released` gaps are
 * user-visible jank, and only they drive anomaly rules.
 */
export interface FrameSampleStats {
  count: number;
  medianGapMs: number;
  maxGapMs: number;
  /** Every observed gap >= 30ms (a missed 60Hz frame), in order. */
  longGaps: number[];
  /** Frames while any transitional screen still carried an active hold. */
  held: FramePhaseStats;
  /** Frames after every hold released — the phase the eye watches. */
  released: FramePhaseStats;
}

/** Stats over the transition player's own gap mirror (__flemoPlayerGaps). */
export interface PlayerGapStats {
  maxMs: number;
  over30Count: number;
}

/** A PerformanceObserver("longtask") entry overlapping the flight window. */
export interface LongTaskSpan {
  startMs: number;
  durationMs: number;
}

/**
 * Whether the motion actually MOVED, as opposed to whether frames arrived.
 *
 * Frame timing and pose progress are different questions, and the 2026-08
 * campaign turned on the difference: a hold attribute re-asserted over a
 * running flight paused the animation for ~250ms while rAF kept ticking at a
 * perfect 16.7ms — every timing metric clean, the screen frozen. The decisive
 * instrument was a pose encoder, so the recorder carries one: for a compiled
 * flight it reads the animation's own clock, for a player flight the inline
 * pose it writes. Neither forces a style flush.
 */
export interface MotionProgress {
  /** Frames sampled during the RELEASED (visible-motion) phase. */
  sampledFrames: number;
  /** Released frames where neither the clock nor the pose moved. */
  stalledFrames: number;
  /** Longest unbroken run of stalled released frames, in ms. */
  longestStallMs: number;
  /** A compiled animation reported playState "paused" after its release. */
  pausedAfterRelease: boolean;
  /** Offset from t0 at which a hold was re-asserted AFTER the release. */
  holdReassertedAtMs: number | null;
}

/**
 * Images inside the flight's participants. A still-loading <img> that
 * finishes DURING the flight decodes and first-rasters on the moving layer —
 * glass-measured at one skipped present per decode (2026-08-18). The engine
 * holds those images for the flight span; an unheld one completing mid-flight
 * is that regression coming back.
 */
export interface ImageActivity {
  /** Participant images not yet complete when the flight opened. */
  loadingAtStart: number;
  /** Of those, how many completed before the landing audit ran. */
  completedDuringFlight: number;
  /** Participant images carrying the engine's hold marker during the flight. */
  heldDuringFlight: number;
}

/** Post-landing residue audit, taken 2 rAF after the flight completed. */
export interface LandingAudit {
  /**
   * Inline transform/opacity left on participating [data-flemo-screen]
   * elements at rest. The landed scope belongs to the compiled rest rules —
   * any inline pose here is a cleanup failure (the flemo PR #259 class).
   */
  residualInlineTransforms: string[];
  /**
   * A COMPLETED+active screen whose computed transform translates it >= 50%
   * of the viewport width off screen: the blank-viewport signature.
   */
  offViewportAtRest: boolean;
  /** Transitional statuses still present ~10s after the flight began. */
  stuckStatuses: string[];
  /**
   * Engine hold markers still on the page at rest. Every hold is supposed to
   * be released when the flight lands; a leftover marker means something is
   * still hidden with no owner left to reveal it — the class that produced
   * ~130 permanently blank avatars before the single-owner guard landed.
   */
  orphanedHolds: string[];
}

/** One recorded navigation flight. */
export interface FlightRecord {
  /** Sequential id, "flight-1"… in recording order. */
  id: string;
  /** data-flemo-router of the first participating screen, if stamped. */
  routerId?: string;
  kind: FlightKind;
  t0: FlightTimestamp;
  t1: FlightTimestamp;
  durationMs: number;
  driver: FlightDriver;
  participants: FlightParticipants;
  holds: FlightHolds;
  frameSamples: FrameSampleStats;
  /** Did the motion advance, frame by frame — not just: did frames arrive. */
  motion: MotionProgress;
  /** Image load/hold activity inside the participants during the flight. */
  images: ImageActivity;
  /** Present only when the player's gap mirror grew during the flight. */
  playerGaps?: PlayerGapStats;
  /**
   * Long tasks intersecting the RELEASED phase (visible motion) — these
   * drive the anomaly rules.
   */
  longTasks: LongTaskSpan[];
  /**
   * Long tasks fully absorbed by the hold phase: the screen was posed, not
   * moving, so these are the engine's commit-absorption working as designed,
   * not user-visible jank.
   */
  holdLongTasks: LongTaskSpan[];
  landing: LandingAudit;
  /** Human/agent-readable findings derived from the data above. */
  anomalies: string[];
}

export interface UaBrand {
  brand: string;
  version: string;
}

/** What this recorder could actually observe in this browser. */
export interface ObservationCapabilities {
  /** PerformanceObserver("longtask") supported — longTasks are meaningful. */
  longTasks: boolean;
  /** Element.getAnimations available — compiled-tier detection is direct. */
  elementAnimations: boolean;
  /** window.__flemoPlayerGaps present (the player has driven >= 1 flight). */
  playerGapMirror: boolean;
}

export interface EnvironmentFingerprint {
  userAgent: string;
  /** navigator.userAgentData.brands, when the browser ships UA-CH. */
  uaBrands: UaBrand[] | null;
  engine: "blink" | "webkit" | "gecko" | "unknown";
  platform: string;
  maxTouchPoints: number;
  devicePixelRatio: number;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  visualViewportScale: number | null;
  /** Idle rAF cadence sampled at attach (median gap over ~20 frames). */
  rafCadence: { medianGapMs: number | null; sampleCount: number };
  reducedMotion: boolean;
  /**
   * DevTools device-emulation signature: Blink + desktop platform + touch
   * points. Emulation composites the page to a scaled surface, so VISUAL
   * reports from such a session are untrustworthy (instruments read the
   * pre-scale surface and say "clean" while the eye watches the post-scale
   * one). Mirrors packages/core/src/core/engine/emulationNotice.ts.
   */
  emulationSuspected: boolean;
  observation: ObservationCapabilities;
}

export interface OverridesSection {
  /**
   * Every `flemo:*` storage key found (sessionStorage + localStorage),
   * including unknown ones and keys that were present at attach but cleared
   * since (marked in the key name). A non-empty map means this session does
   * NOT run stock behavior.
   */
  active: Record<string, string>;
  /** Derived, prominent warnings — read these before trusting anything. */
  warnings: string[];
}

export interface DriverPolicySection {
  /**
   * localStorage `flemo:motion-driver` — the learned ledger. "css" means the
   * device earned a persisted player demotion; "raf" means a clean probe.
   */
  demotion: string | null;
  /**
   * sessionStorage `flemo:motion-driver-force` raw value. NON-NULL MEANS A
   * PIN IS ACTIVE: every transition is forced onto one driver. Almost always
   * A/B residue when found unexpectedly.
   */
  forcePin: string | null;
}

export interface FlemoReport {
  generatedAt: string;
  /** Report schema version (not the package version). */
  version: string;
  environment: EnvironmentFingerprint;
  overrides: OverridesSection;
  driverPolicy: DriverPolicySection;
  flights: FlightRecord[];
  /** Session-level findings (observation traps, active pins, stuck flights). */
  anomalies: string[];
  /**
   * Constant list of layers NO in-page instrument can see. If every field in
   * this report is clean and the user still sees jank, the cause lives in one
   * of these — do not chase them with in-page tooling.
   */
  blindSpots: string[];
  /**
   * Constant list of preconditions a motion verdict is only valid under (see
   * judging.ts). The report cannot verify them from inside the page — an
   * agent must confirm them with the user before trusting any judgement,
   * including a clean one.
   */
  judgingProtocol: string[];
}

export interface FlightRecorderOptions {
  /** Ring-buffer size for recorded flights. Default 50. */
  maxFlights?: number;
  /** console.info a one-line summary per completed flight. Default false. */
  log?: boolean;
  /** Install window.flemo = { report, flights, detach }. Default true. */
  installGlobal?: boolean;
}

export interface FlightRecorderHandle {
  detach: () => void;
  report: () => FlemoReport;
}
