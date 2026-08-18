// Pure formatting for the panel.
//
// Everything here is written for a report whose schema keeps GROWING: fields
// arrive (and occasionally move) as the recorder learns new signals, and a
// panel that throws on a missing key is worse than no panel. So every reader
// takes the value as possibly-absent and renders `—` instead of crashing.

import type { FlemoReport, FlightRecord, FrameSampleStats } from "../types";

/** What a missing/unreadable value renders as. Never blank — an empty cell
 *  reads as "zero", a dash reads as "the recorder did not see this". */
export const DASH = "—";

export const formatText = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === "" ? DASH : String(value);

/** Whole milliseconds — flight durations, long-task spans. */
export const formatMs = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}ms` : DASH;

/** One decimal — frame gaps and rAF cadence, where 16.7 vs 17 matters. */
export const formatGapMs = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 10) / 10}ms` : DASH;

export const formatCount = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : DASH;

export const formatBool = (value: boolean | null | undefined): string =>
  value === true ? "yes" : value === false ? "no" : DASH;

/** Header line: the four facts that decide whether the rest is trustworthy —
 *  which engine, at what density, in what viewport, at what display cadence. */
export const environmentSummary = (report: FlemoReport | null): string => {
  const environment = report?.environment;
  if (!environment) return DASH;
  const viewport = environment.viewport;
  const size =
    viewport && typeof viewport.width === "number" && typeof viewport.height === "number"
      ? `${Math.round(viewport.width)}×${Math.round(viewport.height)}`
      : DASH;
  return [
    formatText(environment.engine),
    `dpr ${formatText(environment.devicePixelRatio)}`,
    size,
    `rAF ${formatGapMs(environment.rafCadence?.medianGapMs)}`
  ].join(" · ");
};

/** Cheap change key for the flight LIST. Rebuilding rows costs nothing when
 *  it is actually needed and everything when it is not, so the list is only
 *  rebuilt when one of these visible values moved. */
export const flightListSignature = (
  flights: readonly FlightRecord[],
  selectedId: string | null
): string =>
  `${selectedId ?? ""}#${flights
    .map(
      (flight) =>
        `${flight?.id ?? ""}|${flight?.kind ?? ""}|${flight?.driver ?? ""}|` +
        `${Math.round(flight?.durationMs ?? 0)}|${flight?.participants?.screens ?? 0}|` +
        `${flight?.anomalies?.length ?? 0}`
    )
    .join(",")}`;

/**
 * Per-frame gap series for the released phase, when the record carries one.
 *
 * The shipped FramePhaseStats is aggregate-only (count / median / max /
 * over30Count), so there is usually nothing to draw and the sparkline is
 * omitted silently. If a future recorder field supplies a numeric series this
 * picks it up without a panel change — but the panel never INVENTS a series
 * it cannot see (a fabricated trace is exactly the kind of artifact that
 * sends an investigation down a blind alley).
 */
export const releasedGapSeries = (frameSamples: FrameSampleStats | undefined): number[] | null => {
  const released = frameSamples?.released as
    | (FrameSampleStats["released"] & {
        gaps?: unknown;
      })
    | undefined;
  const raw = released?.gaps;
  if (!Array.isArray(raw)) return null;
  const series = raw.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  return series.length >= 2 ? series : null;
};
