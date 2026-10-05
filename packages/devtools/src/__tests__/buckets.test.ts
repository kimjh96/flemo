import { describe, expect, it } from "vitest";

import { summariseBuckets } from "../buckets";

import type { TransitionRecord } from "../types";

// THE A/B LADDER, run by the recorder rather than by hand off a console —
// where it twice went wrong, once by copying numbers out of order and once by
// comparing a build that had changed more than one thing.

const transition = (
  bucket: string | undefined,
  durationMs: number,
  over: Partial<TransitionRecord> = {}
) =>
  ({
    id: `transition-${durationMs}`,
    bucket,
    durationMs,
    frameSamples: {
      count: 10,
      medianGapMs: 16.7,
      maxGapMs: 20,
      longGaps: [],
      held: { count: 0, medianGapMs: 0, maxGapMs: 0, over30Count: 0 },
      released: { count: 10, medianGapMs: 16.7, maxGapMs: 20, over30Count: 0 }
    },
    motion: { stalledFrames: 0 },
    anomalies: [],
    ...over
  }) as unknown as TransitionRecord;

describe("summariseBuckets", () => {
  it("stays empty until a label was armed", () => {
    expect(summariseBuckets([transition(undefined, 400)])).toEqual([]);
  });

  it("groups by label and compares on medians, not means", () => {
    const summary = summariseBuckets([
      transition("A", 400),
      transition("A", 420),
      // One outlier: a mean would carry it into the verdict, a median will not.
      transition("A", 2000),
      transition("B", 300),
      transition("B", 320)
    ]);
    expect(summary.map((entry) => entry.bucket)).toEqual(["A", "B"]);
    expect(summary[0].transitions).toBe(3);
    expect(summary[0].medianDurationMs).toBe(420);
    expect(summary[1].medianDurationMs).toBe(320);
  });

  it("carries the worst gap, the drops, the anomalies and the stalls per label", () => {
    const [summary] = summariseBuckets([
      transition("A", 400, {
        frameSamples: {
          count: 10,
          medianGapMs: 16.7,
          maxGapMs: 44,
          longGaps: [44],
          held: { count: 0, medianGapMs: 0, maxGapMs: 0, over30Count: 0 },
          released: { count: 10, medianGapMs: 16.7, maxGapMs: 44, over30Count: 2 }
        },
        motion: { stalledFrames: 4 },
        anomalies: ["one", "two"]
      } as unknown as Partial<TransitionRecord>),
      transition("A", 380)
    ]);
    expect(summary.worstReleasedGapMs).toBe(44);
    expect(summary.longGapCount).toBe(2);
    expect(summary.anomalyCount).toBe(2);
    expect(summary.stalledTransitions).toBe(1);
  });

  it("reports an empty median rather than NaN for a label with nothing in it", () => {
    const [summary] = summariseBuckets([transition("A", 0)]);
    expect(summary.medianDurationMs).toBe(0);
  });
});
