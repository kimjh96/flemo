import type {
  TransitionDriver,
  FrameSampleStats,
  ImageActivity,
  EndAudit,
  LongTaskSpan,
  MorphActivity,
  MotionProgress,
  TripwireHit
} from "./types";

// Anomaly derivation — PURE functions over plain data, so every rule is unit
// testable with synthetic inputs and reusable by the recorder at report time.
// Each string names the signature it matches (agents grep these).

/** A gap at/over this is at least one missed 60Hz frame (mirrors core). */
export const LONG_GAP_MS = 30;
/** A transitional status older than this is a stuck transition. */
export const STUCK_STATUS_MS = 10_000;
/** Long tasks intersecting [t0 - lead, t0 + tail] threaten the opening. */
export const OPENING_WINDOW_LEAD_MS = 50;
export const OPENING_WINDOW_TAIL_MS = 120;
/** Mid-transition long tasks at/over this get their own anomaly line. */
export const MID_TRANSITION_TASK_MS = 100;
/**
 * A stall this long is user-visible. Two dropped 60Hz frames is the smallest
 * run the eye reliably catches on a tracked slide; the release race that
 * motivated this rule froze transitions for ~250ms.
 */
export const STALL_MS = 48;

export interface TransitionAnomalyInput {
  t0Ms: number;
  t1Ms: number;
  driver: TransitionDriver;
  frameSamples: FrameSampleStats;
  /** Long tasks intersecting the RELEASED (visible-motion) phase. */
  longTasks: LongTaskSpan[];
  /** Long tasks fully absorbed by the hold phase (informational only). */
  holdLongTasks: LongTaskSpan[];
  /** Hold release offset from t0 — the start of visible motion (null: no hold). */
  releasedAtMs: number | null;
  endAudit: EndAudit;
  motion: MotionProgress;
  images: ImageActivity;
  morphs: MorphActivity;
  tripwires: TripwireHit[];
}

export const deriveTransitionAnomalies = (input: TransitionAnomalyInput): string[] => {
  const anomalies: string[] = [];
  const { t0Ms, driver, frameSamples, longTasks, holdLongTasks, endAudit } = input;
  // The visible motion starts at the hold release, not the status flip —
  // the engine absorbs heavy commits INTO the hold on purpose, so both the
  // opening window and the gap rules key on the released phase.
  const visibleStartMs = t0Ms + (input.releasedAtMs ?? 0);

  if (frameSamples.released.over30Count > 0) {
    const suffix =
      driver === "compiled"
        ? " (compiled/compositor transitions can still present cleanly through main-thread gaps)"
        : "";
    anomalies.push(
      `main-thread rAF gap up to ${frameSamples.released.maxGapMs}ms ` +
        `×${frameSamples.released.over30Count} during visible motion${suffix}`
    );
  }

  for (const task of longTasks) {
    const overlapsOpening =
      task.startMs <= visibleStartMs + OPENING_WINDOW_TAIL_MS &&
      task.startMs + task.durationMs >= visibleStartMs - OPENING_WINDOW_LEAD_MS;
    if (overlapsOpening) {
      anomalies.push(
        `long task ${Math.round(task.durationMs)}ms overlapped the visible-motion start ` +
          "(opening-swallow risk: the first presented frames of the transition may have been lost)"
      );
    } else if (task.durationMs >= MID_TRANSITION_TASK_MS) {
      anomalies.push(`long task ${Math.round(task.durationMs)}ms mid-transition`);
    }
  }

  for (const task of holdLongTasks) {
    if (task.durationMs >= MID_TRANSITION_TASK_MS) {
      // Informational, not a defect: absorbing exactly these commits is what
      // the hold exists for — worth showing so an agent sees it working.
      anomalies.push(
        `long task ${Math.round(task.durationMs)}ms absorbed by the hold ` +
          "(the screen was held at its starting style, not yet moving: the hold doing its job, not user-visible jank)"
      );
    }
  }

  const { motion, images } = input;

  // The style/timing rules. These exist because frame timing can be perfect
  // while nothing moves: the 2026-08-18 release race paused running transitions
  // for ~250ms with rAF ticking at a clean 16.7ms throughout.
  if (motion.holdReassertedAtMs !== null) {
    anomalies.push(
      `hold re-asserted ${motion.holdReassertedAtMs}ms into the transition, after it had already ` +
        "released (an interleaved commit wrote the stale paused hold attribute over a running " +
        "transition — the flemo 2026-08-18 release-race signature; the motion pauses while every " +
        "timing metric stays clean)"
    );
  }
  if (motion.pausedAfterRelease) {
    anomalies.push(
      "compiled animation reported playState=paused after its release (the transition was " +
        "actually stopped mid-motion, not merely starved of frames)"
    );
  }
  if (motion.longestStallMs >= STALL_MS) {
    anomalies.push(
      `motion stalled ${motion.longestStallMs}ms mid-transition ` +
        `(${motion.stalledFrames}/${motion.sampledFrames} released frames advanced neither the ` +
        "animation's current time nor the rendered style: a freeze, or a freeze then a jump if the " +
        "transition still ended on time)"
    );
  }
  if (motion.sampledFrames === 0 && input.releasedAtMs !== null) {
    anomalies.push(
      "no released frames were sampled (the transition ended at or before its own hold release — " +
        "the visible motion, if any, was never observed)"
    );
  }

  // The image rule. Glass-measured 2026-08-18: one mid-transition decode cost
  // exactly one skipped present, and the engine answers it by holding
  // still-loading images for the transition span.
  if (images.completedUnheld > 0) {
    anomalies.push(
      `${images.completedUnheld} image(s) finished loading mid-transition without a hold ` +
        `(${images.completedDuringTransition} completed, ${images.heldDuringTransition} held; ` +
        `${images.loadingAtStart} were loading at t0, ${images.addedDuringTransition} arrived ` +
        "mid-transition) — each decode rasters on the moving layer and costs a present; this is " +
        "the warm-side image-hold regression"
    );
  }

  if (endAudit.orphanedHolds.length > 0) {
    anomalies.push(
      `hold markers left on the page at rest: ${endAudit.orphanedHolds.join("; ")} ` +
        "(whatever they hide has no owner left to reveal it — the permanently-blank-avatar class)"
    );
  }

  if (endAudit.residualInlineTransforms.length > 0) {
    anomalies.push(
      `residual inline style after COMPLETED: ${endAudit.residualInlineTransforms.join("; ")} ` +
        "(cleanup failure at the end of the transition: once it ends, the screen's style belongs to " +
        "the compiled rest rules)"
    );
  }

  if (endAudit.offViewportAtRest) {
    anomalies.push(
      "screen resting at its starting style while COMPLETED+active (blank-viewport signature, the " +
        "flemo PR #259 class: a leftover inline style kept the screen off the viewport after the " +
        "transition ended)"
    );
  }

  if (endAudit.stuckStatuses.length > 0) {
    anomalies.push(
      `transitional status stuck >${STUCK_STATUS_MS / 1000}s: ${endAudit.stuckStatuses.join(", ")} ` +
        "(navigation queue lock or missed animationend — later navigations will be swallowed)"
    );
  }

  // The morph rules. A shared element that does not pair produces no error and
  // no animation: the element simply appears where it belongs, which is why
  // every one of these needs saying out loud.
  const { morphs, tripwires } = input;

  for (const hit of tripwires) {
    anomalies.push(`tripwire ${hit.kind} at +${hit.atMs}ms: ${hit.detail}`);
  }

  if (morphs.skipped.length > 0) {
    anomalies.push(
      `shared element(s) did not move: ${morphs.skipped.join(", ")} ` +
        `(${morphs.pairable.length} pairable key(s), ${morphs.moved.length} moved) — both ends were ` +
        "registered on two different screens and neither was stamped with a transition role, so the " +
        "pair was never made"
    );
  }

  if (morphs.departureFrames > 2) {
    anomalies.push(
      `a morph's old-screen end stayed visible for ${morphs.departureFrames} frames ` +
        `(up to opacity ${morphs.departureMaxOpacity.toFixed(2)}): its \`exit\` variant is the ` +
        "style the runtime holds that end at, and every preset ends that variant at opacity 0; a " +
        "push hides this and a pop uncovers it as the transition ends"
    );
  }

  if (morphs.partGapFrames > 2 && morphs.partGapPx >= 4) {
    anomalies.push(
      `the part "${morphs.partGapName ?? "?"}" sat up to ${Math.round(morphs.partGapPx)}px ` +
        `narrower than the box carrying it, for ${morphs.partGapFrames} frames — a part is ` +
        "pinned at the width it had when the transition staged it, which on a pop is the width it " +
        "rests at on the side being returned to, so whatever is behind shows through the gap"
    );
  }

  if (morphs.duplicatedKeys.length > 0) {
    anomalies.push(
      `pairing key(s) used twice inside one screen: ${morphs.duplicatedKeys.join(", ")} ` +
        "(two ends under one screen are not a pair, so one of them can never move — this is in " +
        "the consuming app)"
    );
  }

  if (morphs.strandedRoles > 0) {
    anomalies.push(
      `${morphs.strandedRoles} morph element(s) still carry a transition role at rest (the stranded ` +
        "element class: a role that outlives its transition stays in the layer and poisons the " +
        "NEXT pairing, which is how one interrupted gesture turned into every later pop losing " +
        "its camera)"
    );
  }

  if (morphs.strandedStandIns > 0 || morphs.strandedGhosts > 0 || morphs.layerResidue > 0) {
    anomalies.push(
      `morph residue at rest: ${morphs.strandedStandIns} stand-in(s), ${morphs.strandedGhosts} ` +
        `ghost(s), ${morphs.layerResidue} element(s) left in a transition layer (a stand-in is a ` +
        "hole in the layout and a layer element is a corpse the next transition will pair against)"
    );
  }

  if (morphs.leakedSheetRules > 0) {
    anomalies.push(
      `${morphs.leakedSheetRules} morph keyframe rule(s) were left in the per-transition sheet ` +
        "(a transition that never ended keeps its keyframes; they accumulate for the life of the page)"
    );
  }

  if (driver === "unknown") {
    anomalies.push(
      "driver could not be classified (no running flemo-* CSSAnimation and no player inline-style " +
        "signature observed — zero-duration transition, or the sampler attached after motion ended)"
    );
  }

  return anomalies;
};

export interface ReportAnomalyInput {
  emulationSuspected: boolean;
  platform: string;
  /** True when a transition is still transitional past STUCK_STATUS_MS. */
  stuckTransitionOpen: boolean;
  transitionAnomalies: string[][];
}

export const deriveReportAnomalies = (input: ReportAnomalyInput): string[] => {
  const anomalies: string[] = [];

  if (input.emulationSuspected) {
    const windowsCaveat = /Win/i.test(input.platform)
      ? " (Windows touch hardware makes this signal ambiguous — confirm the DevTools device toolbar state)"
      : "";
    anomalies.push(
      "DevTools device emulation suspected — the page composites to a rescaled surface, so visual " +
        "reports from this session are untrustworthy; judge motion in a plain window or on a real device" +
        windowsCaveat
    );
  }

  if (input.stuckTransitionOpen) {
    anomalies.push(
      `a transition is still transitional after ${STUCK_STATUS_MS / 1000}s — the navigation queue is likely ` +
        "locked; subsequent navigations will be ignored"
    );
  }

  const blankViewport = input.transitionAnomalies.some((list) =>
    list.some((entry) => entry.includes("blank-viewport"))
  );
  if (blankViewport) {
    anomalies.push(
      "at least one transition ended with the blank-viewport signature (see that transition's anomalies)"
    );
  }

  return anomalies;
};
