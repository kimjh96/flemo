// Report schema for the flemo transition recorder.
//
// Design goal: an agent (or human) reading ONE serialized FlemoReport cold —
// no access to the page, no follow-up questions to the user — can reconstruct
// what happened: which navigations ran, on which driver tier, how they paced,
// what stalled them, whether the shared elements paired, what residue they
// left, which debug overrides were active, and which observation traps
// invalidate visual reports from the session. Every field is plain
// JSON-serializable data.
//
// READ ORDER, and why the report is shaped this way: `verdict` first, then
// `preconditions`. A number is only evidence if the session it came from was
// allowed to produce evidence, and the campaigns this package exists to end
// were lost precisely there — weeks of clean metrics from sessions with an
// inspector open, a capture running, a development build, or another process
// eating the machine. So the report leads with what it thinks, states what it
// could verify about the session, and only then hands over the data.

/** How a transition's motion was driven, judged from DOM signatures alone. */
export type TransitionDriver =
  // Per-frame inline writing: `animation` suppressed on the screen scope plus
  // an advancing inline transform/opacity. flemo retired its rAF player in
  // 2026-08, so this signature no longer comes from the library — seeing it
  // means SOMETHING ELSE is writing frames onto a screen (a consumer
  // animation, another motion runtime), which is worth knowing.
  | "inline"
  // The compiled-CSS tier: a running CSSAnimation whose name starts with
  // "flemo-" (compositor- or main-thread-presented, engine-dependent).
  | "compiled"
  // Both signatures observed across the elements that move.
  | "mixed"
  // Neither signature observed (zero-duration transition, or the sampler attached
  // after the motion ended).
  | "unknown";

/** Navigation kind, from the transitional `data-flemo-status` value. */
export type TransitionKind = "PUSH" | "POP" | "REPLACE";

/** A single moment on both clocks: monotonic performance.now + wall clock. */
export interface TransitionTimestamp {
  /** performance.now() milliseconds (same clock as longTasks/frame gaps). */
  ms: number;
  /** ISO-8601 wall-clock time, for correlating with external logs. */
  iso: string;
}

/** Elements that carried transitional flemo attributes during the transition. */
export interface TransitionParticipants {
  screens: number;
  bars: number;
  decorators: number;
  parts: number;
}

/** The animation-hold observed on the transition (data-flemo-anim-hold). */
export interface TransitionHolds {
  /** "park-under" | "park-over" | "park" | "true", or null if no hold ran. */
  kind: string | null;
  /**
   * Milliseconds after t0 at which the LAST hold released (every
   * transitional screen's data-flemo-anim-hold at "false"). Null when no
   * hold ran — or when a hold never released (then the whole transition is the
   * held phase).
   */
  releasedAtMs: number | null;
}

/** Frame-gap stats for one phase of a transition (held vs released). */
export interface FramePhaseStats {
  count: number;
  medianGapMs: number;
  maxGapMs: number;
  over30Count: number;
}

/**
 * Stats over the recorder's own rAF-observed frame gaps during the transition,
 * segmented by the anim-hold phase. The engine deliberately absorbs heavy
 * commits INTO the hold (the screen is held at its starting style, not moving), so a gap during
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

/** A PerformanceObserver("longtask") entry overlapping the transition window. */
export interface LongTaskSpan {
  startMs: number;
  durationMs: number;
}

/**
 * Whether the motion actually MOVED, as opposed to whether frames arrived.
 *
 * Frame timing and style progress are different questions, and the 2026-08
 * campaign turned on the difference: a hold attribute re-asserted over a
 * running transition paused the animation for ~250ms while rAF kept ticking at a
 * perfect 16.7ms. Every timing metric was clean and the screen was frozen. The
 * decisive instrument was a progress sampler, so the recorder carries one: for a
 * compiled transition it reads the animation's current time, for an inline-driven
 * one the inline style being written. Neither forces a style flush.
 */
export interface MotionProgress {
  /** Frames sampled during the RELEASED (visible-motion) phase. */
  sampledFrames: number;
  /** Released frames where neither the animation's current time nor the style changed. */
  stalledFrames: number;
  /** Longest unbroken run of stalled released frames, in ms. */
  longestStallMs: number;
  /** A compiled animation reported playState "paused" after its release. */
  pausedAfterRelease: boolean;
  /** Offset from t0 at which a hold was re-asserted AFTER the release. */
  holdReassertedAtMs: number | null;
  /**
   * Released frames sampled AFTER every tracked animation reported "finished".
   * The motion is over there and the style is legitimately still; the transition is
   * simply not closed yet. Counted separately because folding them into
   * `stalledFrames` made a ~50ms "stall" fire on EVERY healthy transition — a
   * constant that masks the real ones (measured on plen, 2026-08-20: 10 of 10
   * transitions, always exactly 3 frames).
   */
  tailFrames: number;
  /**
   * When the first flemo keyframe actually STARTED, relative to t0 — reported
   * by the browser's own `animationstart`, not sampled.
   *
   * The status flip and the first moving frame are different moments: a React
   * commit, a style recalculation and a present sit between them, and on a
   * phone that gap has measured 90-165ms while every other number stayed
   * clean. Null means no flemo animation reported a start for this transition.
   */
  firstAnimationAtMs: number | null;
}

/**
 * Images inside the elements that move. A still-loading <img> that finishes
 * DURING the transition decodes and first-rasters on the moving layer, which
 * costs one skipped frame on screen per decode (measured 2026-08-18). The engine
 * holds those images for the transition span; an unheld one completing
 * mid-transition is that regression coming back.
 */
export interface ImageActivity {
  /** Images inside the elements that move, not yet complete when the transition opened. */
  loadingAtStart: number;
  /**
   * Images that appeared INSIDE an element that moves after the transition
   * opened and were still loading: a data commit arriving mid-navigation. The engine's
   * own image hold watches for exactly these, so the recorder must too.
   */
  addedDuringTransition: number;
  /** Of the tracked images, how many completed before the transition ended. */
  completedDuringTransition: number;
  /** Tracked images seen carrying the engine's hold marker. */
  heldDuringTransition: number;
  /**
   * The number that actually matters: images that completed during the
   * transition WITHOUT a hold, counted per image. Subtracting the two counts
   * above would cancel out a held-but-still-loading image against an
   * unheld completed one and report nothing.
   */
  completedUnheld: number;
}

/**
 * The shared elements on this transition, and whether they actually moved.
 *
 * WHY THIS IS ITS OWN SECTION. A morph that does not pair produces no error,
 * no attribute, no animation and no console line: the element simply appears
 * where it belongs and the navigation looks like one without a shared element
 * at all. Four separate investigations began by hand-building a private tracer
 * to answer the one question "did these two ends find each other", and each
 * one was deleted when it was over. The runtime writes the pairing key onto
 * every registered morph (`data-flemo-morph-id`) precisely so this section can
 * answer it from outside, permanently.
 */
export interface MorphActivity {
  /**
   * Frames where the end on the OLD screen was still visible, and the
   * strongest opacity it was seen at. A morph's `exit` variant is the style the
   * runtime holds that end at, so anything but `opacity: 0` keeps it on screen
   * for the whole transition: hidden on a push, uncovered by a pop.
   */
  departureFrames: number;
  departureMaxOpacity: number;
  /**
   * The widest gap between a `<Part>` inside a moving box and the box itself,
   * which part it was, and for how many frames. A part is pinned at the width
   * it had when the transition started; on a pop that is the returning side's,
   * so the part can sit narrower than the card it is inside for the whole
   * gesture.
   */
  partGapPx: number;
  partGapName: string | null;
  partGapFrames: number;
  /** Registered morphs seen anywhere in the document as the transition opened. */
  registered: number;
  /**
   * Pairing keys carried by ends in TWO different screens: a pair that had
   * everything it needs to move.
   */
  pairable: string[];
  /** Pairing keys whose end was stamped with a transition role (it moved). */
  moved: string[];
  /**
   * Pairable keys that never took a role. This is the morph-skip signature —
   * the pair existed and the transition did not happen.
   */
  skipped: string[];
  /** A screen was driven as a camera (`carry: "screen"`) on this transition. */
  camera: boolean;
  /** Ghosts (copies of the replaced element) seen during the transition. */
  ghosts: number;
  /**
   * Morph elements still stamped with a role once the transition ended. A role
   * outliving its transition is the stranded-element class: it stays in the
   * layer and poisons the NEXT pairing, which is how one interrupted swipe
   * turned into every later pop losing its camera.
   */
  strandedRoles: number;
  /** Stand-ins left in the layout at rest — a hole where the element belongs. */
  strandedStandIns: number;
  /** Ghosts left in the document at rest. */
  strandedGhosts: number;
  /**
   * Morph keyframe rules left in the per-transition sheet at rest, over what the
   * transition started with. One `<style>` element holds them all and outlives
   * every transition, so the rules are the leak, not the element.
   */
  leakedSheetRules: number;
  /**
   * Pairing keys used by more than one end inside a SINGLE screen. Not a
   * runtime failure: two ends under one screen are not a pair, so one of them
   * can never move. Reported because the symptom (an element that morphs only
   * sometimes) reads exactly like a library defect.
   */
  duplicatedKeys: string[];
  /** Elements left inside a transition layer at rest (the corpse class). */
  layerResidue: number;
}

/**
 * A tripwire hit: something the recorder was TOLD about rather than something
 * it sampled.
 *
 * The distinction is the whole reason this exists. Three of this project's
 * hardest defects lasted exactly one frame — a false `animationend` carrying
 * `elapsedTime` 0, an `animationcancel` from a re-parent that let a negative
 * delay overwrite the authored one, a ghost removed a frame before its fade — and
 * a sampler that looks three times a second sees none of them. These are
 * event listeners: they cost nothing while nothing happens, and they cannot
 * miss the frame when it does.
 */
export interface TripwireHit {
  kind: "animation-cancel" | "zero-length-animation-end" | "hold-reassert" | "ghost-cut";
  /** Offset from the transition's t0, in ms. */
  atMs: number;
  /** The animation or element involved, and what the hit means. */
  detail: string;
}

/**
 * What drove this navigation, as the browser reports it.
 *
 * `isTrusted` and `pointerType` are cheap and decisive. A build whose touch
 * path was broken outright once passed every automated layer green because
 * every probe drove it with a mouse, and synthetic dispatch never fires
 * `pointerdown` at all — so a session that only ever saw untrusted or
 * mouse-only input has not tested what a phone does, however clean it reads.
 */
export interface InputEvidence {
  /** Trusted pointer/click events observed shortly before the transition opened. */
  trusted: number;
  /** Untrusted (script-dispatched) ones. */
  synthetic: number;
  /** Distinct `pointerType` values seen ("touch", "mouse", "pen"). */
  pointerTypes: string[];
}

/** Residue audit at the end of the transition, taken 2 rAF after it completed. */
export interface EndAudit {
  /**
   * Inline transform/opacity left at rest on the [data-flemo-screen] elements
   * that took part in the transition. Once the transition ends, the screen's
   * style belongs to the compiled rest rules, so any inline style here is a
   * cleanup failure (the flemo PR #259 class).
   */
  residualInlineTransforms: string[];
  /**
   * A COMPLETED+active screen whose computed transform translates it >= 50%
   * of the viewport width off screen: the blank-viewport signature.
   */
  offViewportAtRest: boolean;
  /** Transitional statuses still present ~10s after the transition began. */
  stuckStatuses: string[];
  /**
   * Engine hold markers still on the page at rest. Every hold is supposed to
   * be released when the transition ends; a leftover marker means something is
   * still hidden with no owner left to reveal it, the class that produced
   * ~130 permanently blank avatars before the single-owner guard shipped.
   */
  orphanedHolds: string[];
}

/** One recorded navigation transition. */
export interface TransitionRecord {
  /** Sequential id, "transition-1"… in recording order. */
  id: string;
  /** data-flemo-router of the first screen in the transition, if stamped. */
  routerId?: string;
  /** The comparison bucket armed when this transition ran (see `mark`). */
  bucket?: string;
  kind: TransitionKind;
  t0: TransitionTimestamp;
  t1: TransitionTimestamp;
  durationMs: number;
  driver: TransitionDriver;
  participants: TransitionParticipants;
  holds: TransitionHolds;
  frameSamples: FrameSampleStats;
  /** Did the motion advance, frame by frame — not just: did frames arrive. */
  motion: MotionProgress;
  /** Image load/hold activity inside the elements that move, during the transition. */
  images: ImageActivity;
  /** Shared elements: which paired, which moved, what they left behind. */
  morphs: MorphActivity;
  /** One-frame events the recorder was notified of rather than sampled. */
  tripwires: TripwireHit[];
  /** What drove the navigation (trusted finger, mouse, or a script). */
  input: InputEvidence;
  /**
   * Long tasks intersecting the RELEASED phase (visible motion) — these
   * drive the anomaly rules.
   */
  longTasks: LongTaskSpan[];
  /**
   * Long tasks fully absorbed by the hold phase: the screen was held still, not
   * moving, so these are the engine's commit-absorption working as designed,
   * not user-visible jank.
   */
  holdLongTasks: LongTaskSpan[];
  endAudit: EndAudit;
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
  /**
   * A flemo-named CSS animation event reached the tripwires at least once.
   *
   * This is the instrument checking ITSELF. A probe that never fires reads
   * exactly like a page with nothing to report, and a build whose probe was
   * silently broken once passed every layer green. If transitions were recorded
   * and this is false, the animation channel saw nothing — treat every
   * animation-derived field in this report as unmeasured, not as clean.
   */
  animationEvents: boolean;
}

export interface EnvironmentFingerprint {
  userAgent: string;
  /** navigator.userAgentData.brands, when the browser ships UA-CH. */
  uaBrands: UaBrand[] | null;
  engine: "blink" | "webkit" | "gecko" | "unknown";
  platform: string;
  maxTouchPoints: number;
  devicePixelRatio: number;
  /** navigator.hardwareConcurrency, for reading a contention number in scale. */
  hardwareConcurrency: number;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  visualViewportScale: number | null;
  /** Idle rAF cadence sampled at attach (median gap over ~20 frames). */
  rafCadence: { medianGapMs: number | null; sampleCount: number };
  reducedMotion: boolean;
  /**
   * Development-server globals found on `window` (HMR clients, framework dev
   * hooks). A development build is a different program: unminified, double-
   * invoking, hot-reload-instrumented. A verdict taken on one says nothing
   * about what ships, and a whole day of "regression ladder" measurements
   * once turned out to be measuring the build itself.
   */
  developmentHints: string[];
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

/** Whether one judging precondition held, as far as the page can tell. */
export type PreconditionStatus = "ok" | "violated" | "unknown";

/**
 * One precondition of a motion verdict, and what the page could observe about
 * it. `unknown` is a first-class answer: several of the traps that cost this
 * project weeks are not visible from inside a page at all, and saying so is
 * the honest report — an agent must then confirm them with the user rather
 * than read silence as consent.
 */
export interface Precondition {
  id: string;
  status: PreconditionStatus;
  detail: string;
  /** Numbers behind the verdict, when there are any. */
  metrics?: Record<string, number>;
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

/**
 * One comparison bucket: every transition recorded while that label was armed.
 *
 * The A/B ladder is this project's standard move and it has been run by hand
 * every time — navigate five times, read five numbers off a console, change
 * one thing, repeat. Doing it in the recorder removes the two ways that went
 * wrong: numbers copied out of order, and a "candidate fix" build that changed
 * more than one thing at once and made the whole judgement void.
 */
export interface BucketSummary {
  bucket: string;
  transitions: number;
  medianDurationMs: number;
  medianReleasedGapMs: number;
  worstReleasedGapMs: number;
  longGapCount: number;
  anomalyCount: number;
  /** Transitions whose motion stalled at least once (see MotionProgress). */
  stalledTransitions: number;
}

/**
 * Transitions carried over from before the last full page load.
 *
 * A development session reloads constantly — HMR, a rebuild, a hard refresh to
 * clear state — and each reload used to take the trace with it, including the
 * one transition the user had just seen go wrong. Kept apart from the live transitions
 * rather than merged: they came from a different page instance, possibly a
 * different build.
 */
export interface PreviousSession {
  savedAt: string;
  transitions: TransitionRecord[];
  note: string;
}

export interface FlemoReport {
  generatedAt: string;
  /** Report schema version (not the package version). */
  version: string;
  /**
   * The recorder's own reading of the session, most important first, in plain
   * sentences. Read this before anything else: it says whether this session
   * can be used as evidence at all, and then what it found.
   */
  verdict: string[];
  environment: EnvironmentFingerprint;
  /** The observable half of the judging protocol, checked. */
  preconditions: Precondition[];
  overrides: OverridesSection;
  transitions: TransitionRecord[];
  /** Per-bucket summaries; empty unless `mark()` armed at least one. */
  comparison: BucketSummary[];
  /** Transitions restored from the previous page instance, or null. */
  previousSession: PreviousSession | null;
  /** Session-level findings (observation traps, active pins, stuck transitions). */
  anomalies: string[];
  /**
   * Constant list of layers NO in-page instrument can see. If every field in
   * this report is clean and the user still sees jank, the cause lives in one
   * of these — do not chase them with in-page tooling.
   */
  blindSpots: string[];
  /**
   * Constant list of preconditions a motion verdict is only valid under (see
   * judging.ts). The ones the page CAN check appear in `preconditions`; these
   * are the rest, which an agent must confirm with the user before trusting
   * any judgement, including a clean one.
   */
  judgingProtocol: string[];
}

export interface TransitionRecorderOptions {
  /** Ring-buffer size for recorded transitions. Default 50. */
  maxTransitions?: number;
  /** console.info a one-line summary per completed transition. Default false. */
  log?: boolean;
  /** Install window.flemo = { report, transitions, mark, detach }. Default true. */
  installGlobal?: boolean;
  /**
   * Carry transitions across a full page load through sessionStorage. Default
   * true — a development session reloads constantly and the transition worth
   * reading is usually the one before the reload. Written only while no
   * transition is running.
   */
  persist?: boolean;
}

export interface TransitionRecorderHandle {
  detach: () => void;
  report: () => FlemoReport;
  /**
   * Arm a comparison bucket. Every transition recorded from here on carries the
   * label until it is changed; `null` clears it. Returns the label in force.
   */
  mark: (bucket: string | null) => string | null;
}
