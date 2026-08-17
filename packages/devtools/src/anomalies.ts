import type {
  FlightDriver,
  FrameSampleStats,
  LandingAudit,
  LongTaskSpan,
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

export interface FlightAnomalyInput {
  t0Ms: number;
  t1Ms: number;
  driver: FlightDriver;
  frameSamples: FrameSampleStats;
  playerGaps: PlayerGapStats | null;
  longTasks: LongTaskSpan[];
  landing: LandingAudit;
}

export const deriveFlightAnomalies = (input: FlightAnomalyInput): string[] => {
  const anomalies: string[] = [];
  const { t0Ms, driver, frameSamples, playerGaps, longTasks, landing } = input;

  if (playerGaps && playerGaps.over30Count > 0) {
    anomalies.push(
      `player frame gap up to ${playerGaps.maxMs}ms ×${playerGaps.over30Count} during flight ` +
        "(the rAF player missed frames — convergence jank on this navigation)"
    );
  }

  if (frameSamples.longGaps.length > 0) {
    const suffix =
      driver === "compiled"
        ? " (compiled/compositor flights can still present cleanly through main-thread gaps)"
        : "";
    anomalies.push(
      `main-thread rAF gap up to ${frameSamples.maxGapMs}ms ×${frameSamples.longGaps.length} ` +
        `during flight${suffix}`
    );
  }

  for (const task of longTasks) {
    const overlapsOpening =
      task.startMs <= t0Ms + OPENING_WINDOW_TAIL_MS &&
      task.startMs + task.durationMs >= t0Ms - OPENING_WINDOW_LEAD_MS;
    if (overlapsOpening) {
      anomalies.push(
        `long task ${Math.round(task.durationMs)}ms overlapped flight start (opening-swallow risk: ` +
          "the first frames of the transition may never have been presented)"
      );
    } else if (task.durationMs >= MID_FLIGHT_TASK_MS) {
      anomalies.push(`long task ${Math.round(task.durationMs)}ms mid-flight`);
    }
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
  forcePin: string | null;
  legacyLocalForcePin: string | null;
  /** Force-pin value seen at attach but cleared by report time, if any. */
  clearedForcePin: string | null;
  emulationSuspected: boolean;
  platform: string;
  /** True when a flight is still transitional past STUCK_STATUS_MS. */
  stuckFlightOpen: boolean;
  flightAnomalies: string[][];
}

export const deriveReportAnomalies = (input: ReportAnomalyInput): string[] => {
  const anomalies: string[] = [];

  if (input.forcePin !== null) {
    anomalies.push(
      `active force pin flemo:motion-driver-force=${input.forcePin} — every transition this session ` +
        "is pinned to one driver (A/B residue? pins expire after 24h; clear the key before judging behavior)"
    );
  }
  if (input.clearedForcePin !== null && input.forcePin === null) {
    anomalies.push(
      `force pin flemo:motion-driver-force=${input.clearedForcePin} was present at attach and has since ` +
        "been cleared (the library strips malformed/expired pins on sight) — early driver decisions in " +
        "this session may still have been shaped by it"
    );
  }
  if (input.legacyLocalForcePin !== null) {
    anomalies.push(
      `legacy localStorage driver pin present (flemo:motion-driver-force=${input.legacyLocalForcePin}) — ` +
        "never honored, but it marks A/B residue on this profile"
    );
  }

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
