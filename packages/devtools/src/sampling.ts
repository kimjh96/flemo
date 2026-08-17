import { LONG_GAP_MS } from "./anomalies";

import type { FlightDriver, FlightKind, FrameSampleStats, PlayerGapStats } from "./types";

// Pure helpers over sampled flight data. Kept free of DOM access so anomaly
// pipelines are testable with synthetic inputs.

const round1 = (value: number) => Math.round(value * 10) / 10;

export const computeFrameStats = (gaps: readonly number[]): FrameSampleStats => {
  if (gaps.length === 0) {
    return { count: 0, medianGapMs: 0, maxGapMs: 0, longGaps: [] };
  }
  const sorted = [...gaps].sort((left, right) => left - right);
  return {
    count: gaps.length,
    medianGapMs: round1(sorted[Math.floor(sorted.length / 2)]),
    maxGapMs: round1(sorted[sorted.length - 1]),
    longGaps: gaps.filter((gap) => gap >= LONG_GAP_MS).map(round1)
  };
};

export const computePlayerGapStats = (gaps: readonly number[]): PlayerGapStats | null => {
  if (gaps.length === 0) return null;
  return {
    maxMs: round1(Math.max(...gaps)),
    over30Count: gaps.filter((gap) => gap >= LONG_GAP_MS).length
  };
};

/** Driver evidence gathered by the rAF sampler during a flight. */
export interface DriverEvidence {
  /** A running CSSAnimation named flemo-* was observed on a participant. */
  compiledAnimation: boolean;
  /** A participant carried inline `animation` suppression (player stake). */
  playerSuppression: boolean;
  /** Inline transform/opacity advanced between sampled frames. */
  playerAdvance: boolean;
}

export const classifyDriver = (evidence: DriverEvidence): FlightDriver => {
  const player = evidence.playerSuppression || evidence.playerAdvance;
  if (player && evidence.compiledAnimation) return "mixed";
  if (player) return "player";
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
