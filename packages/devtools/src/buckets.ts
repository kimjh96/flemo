import type { BucketSummary, TransitionRecord } from "./types";

// COMPARISON BUCKETS: the A/B ladder, run by the recorder instead of by hand.
//
// The standard move in this project when a change might have helped is to
// navigate five times, read five numbers, change one thing and repeat. Done by
// hand it went wrong twice in ways that voided whole days: numbers copied out
// of order, and a "candidate fix" build that changed more than one thing at
// once so neither side measured what it claimed.
//
// `mark("A")` labels every transition recorded from then on. The summary below is
// what the two labels are actually compared on — medians rather than means,
// because a single 400ms outlier is exactly what a median is for and exactly
// what a mean hides.

const median = (values: number[]): number => {
  /* v8 ignore next -- unreachable: a group exists only because a transition was
  put in it, so nothing ever asks for the median of nothing. */
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10;
};

export const summariseBuckets = (transitions: readonly TransitionRecord[]): BucketSummary[] => {
  const labelled = transitions.filter((transition) => typeof transition.bucket === "string");
  if (labelled.length === 0) return [];
  const groups = new Map<string, TransitionRecord[]>();
  for (const transition of labelled) {
    const key = transition.bucket as string;
    const group = groups.get(key);
    if (group) group.push(transition);
    else groups.set(key, [transition]);
  }
  return [...groups.entries()]
    .map(([bucket, group]) => ({
      bucket,
      transitions: group.length,
      medianDurationMs: median(group.map((transition) => transition.durationMs)),
      medianReleasedGapMs: median(
        group.map((transition) => transition.frameSamples.released.medianGapMs)
      ),
      worstReleasedGapMs: group.reduce(
        (worst, transition) => Math.max(worst, transition.frameSamples.released.maxGapMs),
        0
      ),
      longGapCount: group.reduce(
        (total, transition) => total + transition.frameSamples.released.over30Count,
        0
      ),
      anomalyCount: group.reduce((total, transition) => total + transition.anomalies.length, 0),
      stalledTransitions: group.filter((transition) => transition.motion.stalledFrames > 0).length
    }))
    .sort((left, right) => left.bucket.localeCompare(right.bucket));
};
