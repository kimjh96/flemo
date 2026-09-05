import type { BucketSummary, FlightRecord } from "./types";

// COMPARISON BUCKETS: the A/B ladder, run by the recorder instead of by hand.
//
// The standard move in this project when a change might have helped is to
// navigate five times, read five numbers, change one thing and repeat. Done by
// hand it went wrong twice in ways that voided whole days: numbers copied out
// of order, and a "candidate fix" build that changed more than one thing at
// once so neither side measured what it claimed.
//
// `mark("A")` labels every flight recorded from then on. The summary below is
// what the two labels are actually compared on — medians rather than means,
// because a single 400ms outlier is exactly what a median is for and exactly
// what a mean hides.

const median = (values: number[]): number => {
  /* v8 ignore next -- unreachable: a group exists only because a flight was
  put in it, so nothing ever asks for the median of nothing. */
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10;
};

export const summariseBuckets = (flights: readonly FlightRecord[]): BucketSummary[] => {
  const labelled = flights.filter((flight) => typeof flight.bucket === "string");
  if (labelled.length === 0) return [];
  const groups = new Map<string, FlightRecord[]>();
  for (const flight of labelled) {
    const key = flight.bucket as string;
    const group = groups.get(key);
    if (group) group.push(flight);
    else groups.set(key, [flight]);
  }
  return [...groups.entries()]
    .map(([bucket, group]) => ({
      bucket,
      flights: group.length,
      medianDurationMs: median(group.map((flight) => flight.durationMs)),
      medianReleasedGapMs: median(group.map((flight) => flight.frameSamples.released.medianGapMs)),
      worstReleasedGapMs: group.reduce(
        (worst, flight) => Math.max(worst, flight.frameSamples.released.maxGapMs),
        0
      ),
      longGapCount: group.reduce(
        (total, flight) => total + flight.frameSamples.released.over30Count,
        0
      ),
      anomalyCount: group.reduce((total, flight) => total + flight.anomalies.length, 0),
      stalledFlights: group.filter((flight) => flight.motion.stalledFrames > 0).length
    }))
    .sort((left, right) => left.bucket.localeCompare(right.bucket));
};
