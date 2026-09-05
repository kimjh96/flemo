import { LONG_GAP_MS } from "./anomalies";

import type { DriverEvidence } from "./frameProbe";

import type { FlightDriver, FlightKind, FramePhaseStats, FrameSampleStats } from "./types";

// Pure helpers over sampled flight data. Kept free of DOM access so anomaly
// pipelines are testable with synthetic inputs.

const round1 = (value: number) => Math.round(value * 10) / 10;

export const computePhaseStats = (gaps: readonly number[]): FramePhaseStats => {
  if (gaps.length === 0) {
    return { count: 0, medianGapMs: 0, maxGapMs: 0, over30Count: 0 };
  }
  const sorted = [...gaps].sort((left, right) => left - right);
  return {
    count: gaps.length,
    medianGapMs: round1(sorted[Math.floor(sorted.length / 2)]),
    maxGapMs: round1(sorted[sorted.length - 1]),
    over30Count: gaps.filter((gap) => gap >= LONG_GAP_MS).length
  };
};

/**
 * Combined frame stats: `heldGaps` are frames sampled while any transitional
 * screen still carried an active anim-hold; `releasedGaps` are frames after
 * every hold released. The hold phase precedes release, so the overall
 * ordered gap list is their concatenation.
 */
export const computeFrameStats = (
  heldGaps: readonly number[],
  releasedGaps: readonly number[] = []
): FrameSampleStats => {
  const gaps = [...heldGaps, ...releasedGaps];
  const overall =
    gaps.length === 0
      ? { count: 0, medianGapMs: 0, maxGapMs: 0 }
      : (() => {
          const sorted = [...gaps].sort((left, right) => left - right);
          return {
            count: gaps.length,
            medianGapMs: round1(sorted[Math.floor(sorted.length / 2)]),
            maxGapMs: round1(sorted[sorted.length - 1])
          };
        })();
  return {
    ...overall,
    longGaps: gaps.filter((gap) => gap >= LONG_GAP_MS).map(round1),
    held: computePhaseStats(heldGaps),
    released: computePhaseStats(releasedGaps)
  };
};

/**
 * Which tier drove the flight.
 *
 * The library compiles every animation, so `inline` never comes from flemo:
 * it means SOMETHING ELSE was writing frames onto a participant, which is
 * worth knowing and is why the signature is still watched for.
 */
export const classifyDriver = (evidence: DriverEvidence): FlightDriver => {
  const inline = evidence.inlineSuppression || evidence.inlineAdvance;
  if (inline && evidence.compiledAnimation) return "mixed";
  if (inline) return "inline";
  if (evidence.compiledAnimation) return "compiled";
  return "unknown";
};

export const kindFromStatus = (status: string): FlightKind | null => {
  if (status === "PUSHING") return "PUSH";
  if (status === "POPPING") return "POP";
  if (status === "REPLACING") return "REPLACE";
  return null;
};

/**
 * Horizontal translation of a computed `transform` matrix, in px. Returns
 * null for "none"/"" or unparseable values.
 */
export const parseTranslateX = (transform: string): number | null => {
  const matrix3d = /^matrix3d\(([^)]+)\)$/.exec(transform.trim());
  if (matrix3d) {
    const parts = matrix3d[1].split(",").map((part) => Number(part.trim()));
    return parts.length === 16 && Number.isFinite(parts[12]) ? parts[12] : null;
  }
  const matrix = /^matrix\(([^)]+)\)$/.exec(transform.trim());
  if (matrix) {
    const parts = matrix[1].split(",").map((part) => Number(part.trim()));
    return parts.length === 6 && Number.isFinite(parts[4]) ? parts[4] : null;
  }
  return null;
};
