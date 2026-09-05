import { LONG_GAP_MS, STALL_MS } from "./anomalies";

import type { FlightRecord, ObservationCapabilities, Precondition } from "./types";

// THE VERDICT: what the recorder thinks, in sentences, at the top of the
// report.
//
// A report that is only data makes its reader do the judging, and the judging
// is where this project lost its time — a clean table read as "the library is
// fine" when the session it came from was not allowed to produce evidence at
// all. So the verdict leads, it refuses to summarise data from an invalid
// session as if it were a finding, and it is derived from the FLIGHT FIELDS
// rather than from the anomaly strings, so nobody has to keep two vocabularies
// in step.

export interface VerdictInput {
  preconditions: readonly Precondition[];
  flights: readonly FlightRecord[];
  observation: ObservationCapabilities;
}

const median = (values: number[]): number => {
  /* v8 ignore next -- unreachable: deriveVerdict returns before this on an
  empty flight list, so nothing ever asks for the median of nothing. */
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

export const deriveVerdict = (input: VerdictInput): string[] => {
  const lines: string[] = [];
  const violated = input.preconditions.filter((check) => check.status === "violated");

  if (violated.length > 0) {
    lines.push(
      `NOT EVIDENCE: ${violated.length} judging precondition(s) failed — ` +
        `${violated.map((check) => check.id).join(", ")}. Everything below was measured under ` +
        "those conditions; fix them and measure again before drawing a conclusion from it."
    );
  }

  if (input.flights.length === 0) {
    lines.push(
      "No flights were recorded. Either no navigation happened while the recorder was attached, " +
        "or it attached after the one you meant to measure — the recorder only sees flights that " +
        "start after it does."
    );
    return lines;
  }

  if (!input.observation.animationEvents) {
    lines.push(
      "The animation channel observed NOTHING across this whole session: not one flemo keyframe " +
        "reported a start, an end or a cancel, though flights were recorded. Treat every " +
        "animation-derived field here as unmeasured rather than as clean — a probe that never " +
        "fires reads exactly like a page with nothing to report."
    );
  }

  const flights = input.flights;
  const worstGap = flights.reduce(
    (worst, flight) => Math.max(worst, flight.frameSamples.released.maxGapMs),
    0
  );
  const withAnomalies = flights.filter((flight) => flight.anomalies.length > 0).length;
  lines.push(
    `${flights.length} flight(s) recorded. Median duration ` +
      `${median(flights.map((flight) => flight.durationMs))}ms, worst frame gap during visible ` +
      `motion ${worstGap}ms, ${withAnomalies} flight(s) carrying at least one anomaly.`
  );

  const stalled = flights.filter((flight) => flight.motion.longestStallMs >= STALL_MS);
  if (stalled.length > 0) {
    lines.push(
      `${stalled.length} flight(s) STOPPED MOVING mid-flight (longest ` +
        `${Math.max(...stalled.map((flight) => flight.motion.longestStallMs))}ms). Frames kept ` +
        "arriving; the picture did not change. Look at the hold and the animation's play state, " +
        "not at the frame budget."
    );
  }

  const skipped = flights.filter((flight) => flight.morphs.skipped.length > 0);
  if (skipped.length > 0) {
    const keys = [...new Set(skipped.flatMap((flight) => flight.morphs.skipped))];
    lines.push(
      `Shared elements did NOT fly on ${skipped.length} flight(s): ${keys.join(", ")}. Both ends ` +
        "were registered on two different screens and neither was ever stamped with a flight " +
        "role, so the pair was never made. This is silent by nature — nothing else on the page " +
        "says it happened."
    );
  }

  const duplicated = [...new Set(flights.flatMap((flight) => flight.morphs.duplicatedKeys))];
  if (duplicated.length > 0) {
    lines.push(
      `Pairing key(s) used twice inside one screen: ${duplicated.join(", ")}. Two ends under one ` +
        "screen are not a pair, so one of them can never fly. This is in the consuming app, not " +
        "in the library."
    );
  }

  const tripped = flights.flatMap((flight) => flight.tripwires);
  if (tripped.length > 0) {
    const kinds = [...new Set(tripped.map((hit) => hit.kind))];
    lines.push(
      `${tripped.length} tripwire hit(s) across the session (${kinds.join(", ")}). These are ` +
        "one-frame events reported by the browser itself, not sampled — read the flights' " +
        "`tripwires` arrays for the exact animations."
    );
  }

  const laggy = flights.filter((flight) => flight.frameSamples.released.over30Count > 0).length;
  if (laggy === 0 && withAnomalies === 0 && violated.length === 0) {
    lines.push(
      `No flight dropped a frame during visible motion (nothing at or over ${LONG_GAP_MS}ms) and ` +
        "no anomaly fired. Under the preconditions above, this session is clean — what remains " +
        "is in `blindSpots`, and none of it is reachable from page code."
    );
  }

  return lines;
};
