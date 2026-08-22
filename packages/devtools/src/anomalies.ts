import type {
  FlightDriver,
  FrameSampleStats,
  ImageActivity,
  LandingAudit,
  LongTaskSpan,
  MotionProgress,
  PlayerGapStats
} from "./types";

// Anomaly derivation — PURE functions over plain data, so every rule is unit
// testable with synthetic inputs and reusable by the recorder at report time.
// Each string names the signature it matches (agents grep these).

/** A gap at/over this is at least one missed 60Hz frame (mirrors core). */
export const LONG_GAP_MS = 30;
/** A transitional status older than this is a stuck flight. */
export const STUCK_STATUS_MS = 10_000;
/** Long tasks intersecting [t0 - lead, t0 + tail] threaten the opening. */
export const OPENING_WINDOW_LEAD_MS = 50;
export const OPENING_WINDOW_TAIL_MS = 120;
/** Mid-flight long tasks at/over this get their own anomaly line. */
export const MID_FLIGHT_TASK_MS = 100;
/**
 * A stall this long is user-visible. Two dropped 60Hz frames is the smallest
 * run the eye reliably catches on a tracked slide; the release race that
 * motivated this rule froze flights for ~250ms.
 */
export const STALL_MS = 48;

export interface FlightAnomalyInput {
  t0Ms: number;
  t1Ms: number;
  driver: FlightDriver;
  frameSamples: FrameSampleStats;
  playerGaps: PlayerGapStats | null;
  /** Long tasks intersecting the RELEASED (visible-motion) phase. */
  longTasks: LongTaskSpan[];
  /** Long tasks fully absorbed by the hold phase (informational only). */
  holdLongTasks: LongTaskSpan[];
  /** Hold release offset from t0 — the start of visible motion (null: no hold). */
  releasedAtMs: number | null;
  landing: LandingAudit;
  motion: MotionProgress;
  images: ImageActivity;
}

export const deriveFlightAnomalies = (input: FlightAnomalyInput): string[] => {
  const anomalies: string[] = [];
  const { t0Ms, driver, frameSamples, playerGaps, longTasks, holdLongTasks, landing } = input;
  // The visible motion starts at the hold release, not the status flip —
  // the engine absorbs heavy commits INTO the hold on purpose, so both the
  // opening window and the gap rules key on the released phase.
  const visibleStartMs = t0Ms + (input.releasedAtMs ?? 0);

  if (playerGaps && playerGaps.over30Count > 0) {
    anomalies.push(
      `player frame gap up to ${playerGaps.maxMs}ms ×${playerGaps.over30Count} during flight ` +
        "(the rAF player missed frames — convergence jank on this navigation)"
    );
  }

  if (frameSamples.released.over30Count > 0) {
    const suffix =
      driver === "compiled"
        ? " (compiled/compositor flights can still present cleanly through main-thread gaps)"
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
    } else if (task.durationMs >= MID_FLIGHT_TASK_MS) {
      anomalies.push(`long task ${Math.round(task.durationMs)}ms mid-flight`);
    }
  }

  for (const task of holdLongTasks) {
    if (task.durationMs >= MID_FLIGHT_TASK_MS) {
      // Informational, not a defect: absorbing exactly these commits is what
      // the hold exists for — worth showing so an agent sees it working.
      anomalies.push(
        `long task ${Math.round(task.durationMs)}ms absorbed by the hold ` +
          "(screen posed, not yet moving — the hold doing its job, not user-visible jank)"
      );
    }
  }

  const { motion, images } = input;

  // The pose/clock rules. These exist because frame timing can be perfect
  // while nothing moves: the 2026-08-18 release race paused running flights
  // for ~250ms with rAF ticking at a clean 16.7ms throughout.
  if (motion.holdReassertedAtMs !== null) {
    anomalies.push(
      `hold re-asserted ${motion.holdReassertedAtMs}ms into the flight, after it had already ` +
        "released (an interleaved commit wrote the stale paused hold attribute over a running " +
        "flight — the flemo 2026-08-18 release-race signature; the motion pauses while every " +
        "timing metric stays clean)"
    );
  }
  if (motion.pausedAfterRelease) {
    anomalies.push(
      "compiled animation reported playState=paused after its release (the flight was posed " +
        "and then stopped mid-motion, not merely starved of frames)"
    );
  }
  if (motion.longestStallMs >= STALL_MS) {
    anomalies.push(
      `motion stalled ${motion.longestStallMs}ms mid-flight ` +
        `(${motion.stalledFrames}/${motion.sampledFrames} released frames advanced neither the ` +
        "animation clock nor the pose — freeze, or freeze-then-leap if the flight still landed on time)"
    );
  }
  if (motion.sampledFrames === 0 && input.releasedAtMs !== null) {
    anomalies.push(
      "no released frames were sampled (the flight ended at or before its own hold release — " +
        "the visible motion, if any, was never observed)"
    );
  }

  // The image rule. Glass-measured 2026-08-18: one mid-flight decode cost
  // exactly one skipped present, and the engine answers it by holding
  // still-loading images for the flight span.
  if (images.completedUnheld > 0) {
    anomalies.push(
      `${images.completedUnheld} image(s) finished loading mid-flight without a hold ` +
        `(${images.completedDuringFlight} completed, ${images.heldDuringFlight} held; ` +
        `${images.loadingAtStart} were loading at t0, ${images.addedDuringFlight} arrived ` +
        "mid-flight) — each decode rasters on the moving layer and costs a present; this is " +
        "the warm-side image-hold regression"
    );
  }

  if (landing.orphanedHolds.length > 0) {
    anomalies.push(
      `hold markers left on the page at rest: ${landing.orphanedHolds.join("; ")} ` +
        "(whatever they hide has no owner left to reveal it — the permanently-blank-avatar class)"
    );
  }

  if (landing.residualInlineTransforms.length > 0) {
    anomalies.push(
      `residual inline style after COMPLETED: ${landing.residualInlineTransforms.join("; ")} ` +
        "(landing cleanup failure — the landed scope belongs to the compiled rest rules)"
    );
  }

  if (landing.offViewportAtRest) {
    anomalies.push(
      "screen resting at from-pose while COMPLETED+active (blank-viewport signature — the flemo " +
        "PR #259 class: a residual pose left the landed screen parked off-viewport)"
    );
  }

  if (landing.stuckStatuses.length > 0) {
    anomalies.push(
      `transitional status stuck >${STUCK_STATUS_MS / 1000}s: ${landing.stuckStatuses.join(", ")} ` +
        "(navigation queue lock or missed animationend — later navigations will be swallowed)"
    );
  }

  if (driver === "unknown") {
    anomalies.push(
      "driver could not be classified (no running flemo-* CSSAnimation and no player inline-style " +
        "signature observed — zero-duration flight, or the sampler attached after motion ended)"
    );
  }

  return anomalies;
};

export interface ReportAnomalyInput {
  emulationSuspected: boolean;
  platform: string;
  /** True when a flight is still transitional past STUCK_STATUS_MS. */
  stuckFlightOpen: boolean;
  flightAnomalies: string[][];
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

  if (input.stuckFlightOpen) {
    anomalies.push(
      `a flight is still transitional after ${STUCK_STATUS_MS / 1000}s — the navigation queue is likely ` +
        "locked; subsequent navigations will be ignored"
    );
  }

  const blankViewport = input.flightAnomalies.some((list) =>
    list.some((entry) => entry.includes("blank-viewport"))
  );
  if (blankViewport) {
    anomalies.push(
      "at least one flight landed with the blank-viewport signature (see that flight's anomalies)"
    );
  }

  return anomalies;
};
