// Rendering for the panel's three data regions: the header chips, the flight
// list, and the flight detail. Each function fully rebuilds its own region
// and nothing else — the caller decides WHEN a region may be rebuilt (only
// while no flight is in progress, and only when a change key moved).

import { clear, el, svgEl } from "./dom";
import {
  DASH,
  formatBool,
  formatCount,
  formatGapMs,
  formatMs,
  formatText,
  releasedGapSeries
} from "./format";

import type { FlemoReport, FlightRecord, FramePhaseStats, LongTaskSpan } from "../types";

/** Mirrors anomalies.ts STALL_MS — the point a stall becomes user-visible. */
const STALL_TONE_MS = 48;

const kv = (parent: Element, key: string, value: string, tone?: "bad"): void => {
  const row = el("div", "kv");
  row.appendChild(el("span", "k", key));
  row.appendChild(el("span", tone ? `v ${tone}` : "v", value));
  parent.appendChild(row);
};

const section = (parent: Element, title: string): HTMLElement => {
  const node = el("section", "section");
  node.appendChild(el("h2", undefined, title));
  parent.appendChild(node);
  return node;
};

const line = (parent: Element, text: string, className = "li"): void => {
  parent.appendChild(el("div", className, text));
};

/**
 * Header chips: override warnings and session-level anomalies first (they
 * decide whether the rest of the report describes stock behavior at all),
 * then the raw active overrides. Values come from storage the user can edit,
 * so they land via textContent like everything else.
 */
export const renderChips = (node: Element, report: FlemoReport | null): void => {
  clear(node);
  // The verdict first, then the preconditions it rests on. A number read
  // without them is what this package exists to stop happening.
  for (const sentence of report?.verdict ?? []) {
    node.appendChild(el("span", "chip lead", formatText(sentence)));
  }
  for (const check of report?.preconditions ?? []) {
    if (check?.status !== "violated") continue;
    node.appendChild(el("span", "chip bad", `${check.id}: ${formatText(check.detail)}`));
  }
  for (const warning of report?.overrides?.warnings ?? []) {
    node.appendChild(el("span", "chip warn", formatText(warning)));
  }
  for (const anomaly of report?.anomalies ?? []) {
    node.appendChild(el("span", "chip bad", formatText(anomaly)));
  }
  for (const [key, value] of Object.entries(report?.overrides?.active ?? {})) {
    node.appendChild(el("span", "chip", `${key}=${String(value)}`));
  }
};

/** Newest first — the flight you just ran is the one you came to look at. */
export const renderFlightList = (
  node: Element,
  flights: readonly FlightRecord[],
  selectedId: string | null,
  onSelect: (id: string) => void
): void => {
  clear(node);
  if (flights.length === 0) {
    line(node, "no flights recorded yet — navigate once", "li dim");
    return;
  }
  for (let index = flights.length - 1; index >= 0; index -= 1) {
    const flight = flights[index];
    const id = formatText(flight?.id);
    const row = el("button", "row");
    row.type = "button";
    row.setAttribute("data-flight-id", id);
    row.setAttribute("aria-selected", String(id === selectedId));
    row.appendChild(el("span", "kind", formatText(flight?.kind)));
    row.appendChild(el("span", "driver", formatText(flight?.driver)));
    row.appendChild(el("span", "dur", formatMs(flight?.durationMs)));
    row.appendChild(el("span", "screens", `${formatCount(flight?.participants?.screens)} scr`));
    const count = flight?.anomalies?.length ?? 0;
    row.appendChild(el("span", count > 0 ? "n bad" : "n", String(count)));
    row.addEventListener("click", () => onSelect(id));
    node.appendChild(row);
  }
};

const renderPhase = (parent: Element, label: string, stats: FramePhaseStats | undefined): void => {
  if (!stats) {
    kv(parent, label, DASH);
    return;
  }
  const parts = [
    `${formatCount(stats.count)} frames`,
    `median ${formatGapMs(stats.medianGapMs)}`,
    `max ${formatGapMs(stats.maxGapMs)}`
  ];
  if (typeof stats.over30Count === "number") parts.push(`>30ms ×${stats.over30Count}`);
  kv(parent, label, parts.join(" · "));
};

/** One inline SVG, built once per refresh. No canvas, no rAF, no re-draw. */
const sparkline = (series: readonly number[]): SVGElement => {
  const width = 100;
  const height = 28;
  const peak = Math.max(...series);
  const span = peak > 0 ? peak : 1;
  const step = width / (series.length - 1);
  const points = series
    .map((value, index) => {
      const x = Math.round(index * step * 10) / 10;
      const y = Math.round((height - 1 - (value / span) * (height - 2)) * 10) / 10;
      return `${x},${y}`;
    })
    .join(" ");
  const svg = svgEl("svg", {
    class: "spark",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    "aria-hidden": "true"
  });
  svg.appendChild(
    svgEl("polyline", {
      points,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1",
      "vector-effect": "non-scaling-stroke"
    })
  );
  return svg;
};

const renderLongTasks = (parent: Element, flight: FlightRecord): void => {
  const visible = flight.longTasks ?? [];
  const absorbed = flight.holdLongTasks ?? [];
  if (visible.length === 0 && absorbed.length === 0) {
    line(parent, "none", "li dim");
    return;
  }
  const describe = (task: LongTaskSpan | undefined) =>
    `${formatMs(task?.startMs)} + ${formatMs(task?.durationMs)}`;
  for (const task of visible) line(parent, describe(task), "li bad");
  // Absorbed tasks ran while the screen was posed, not moving: the engine's
  // commit absorption working as designed, never a finding.
  for (const task of absorbed) line(parent, `${describe(task)} (absorbed by hold)`, "li dim");
};

export const renderFlightDetail = (node: Element, flight: FlightRecord | null): void => {
  clear(node);
  if (!flight) {
    line(node, "select a flight", "li dim");
    return;
  }

  const timing = section(node, "timing");
  kv(timing, "id", formatText(flight.id));
  kv(timing, "kind / driver", `${formatText(flight.kind)} · ${formatText(flight.driver)}`);
  kv(timing, "router", formatText(flight.routerId));
  kv(timing, "t0", formatText(flight.t0?.iso));
  kv(timing, "duration", formatMs(flight.durationMs));
  kv(
    timing,
    "participants",
    `${formatCount(flight.participants?.screens)} screens · ` +
      `${formatCount(flight.participants?.bars)} bars · ` +
      `${formatCount(flight.participants?.decorators)} decorators · ` +
      `${formatCount(flight.participants?.parts)} parts`
  );
  kv(
    timing,
    "hold",
    `${formatText(flight.holds?.kind)} · released ${formatMs(flight.holds?.releasedAtMs)}`
  );

  const frames = section(node, "frames");
  renderPhase(frames, "held (absorbed)", flight.frameSamples?.held);
  renderPhase(frames, "released (visible)", flight.frameSamples?.released);
  const series = releasedGapSeries(flight.frameSamples);
  if (series) frames.appendChild(sparkline(series));

  // Did it MOVE — the question frame timing cannot answer. Every defect of
  // the 2026-08-18 round had perfect gaps while the screen stood still, so
  // these rows are the ones to read first when a user says "버벅" and the
  // frame stats look clean.
  const motion = section(node, "motion (did it move)");
  const stall = flight.motion?.longestStallMs;
  const reasserted = flight.motion?.holdReassertedAtMs;
  kv(motion, "released frames", formatCount(flight.motion?.sampledFrames));
  kv(
    motion,
    "stalled frames",
    formatCount(flight.motion?.stalledFrames),
    (flight.motion?.stalledFrames ?? 0) > 0 ? "bad" : undefined
  );
  kv(motion, "longest stall", formatMs(stall), (stall ?? 0) >= STALL_TONE_MS ? "bad" : undefined);
  kv(
    motion,
    "paused after release",
    formatBool(flight.motion?.pausedAfterRelease),
    flight.motion?.pausedAfterRelease === true ? "bad" : undefined
  );
  kv(
    motion,
    "hold re-asserted",
    reasserted === null || reasserted === undefined ? "no" : formatMs(reasserted),
    typeof reasserted === "number" ? "bad" : undefined
  );
  // The status flip and the first moving frame are different moments, and on a
  // phone the distance between them has measured 90-165ms. Reported, not
  // judged: that gap belongs to the commit and the present, not the transition.
  kv(
    motion,
    "first animation",
    flight.motion?.firstAnimationAtMs === null || flight.motion?.firstAnimationAtMs === undefined
      ? "not observed"
      : `+${formatMs(flight.motion.firstAnimationAtMs)} after t0`
  );

  // Shared elements. A pair that never flew is silent everywhere else on the
  // page: no error, no attribute, no animation — the element simply appears
  // where it belongs, which looks exactly like a navigation without one.
  const morphs = flight.morphs;
  if (morphs) {
    const shared = section(node, "shared elements");
    kv(shared, "registered", formatCount(morphs.registered));
    kv(
      shared,
      "pairable / flew",
      `${formatCount(morphs.pairable?.length)} · ${formatCount(morphs.flew?.length)}`
    );
    const skipped = morphs.skipped ?? [];
    kv(
      shared,
      "did not fly",
      skipped.length === 0 ? "none" : skipped.join(", "),
      skipped.length > 0 ? "bad" : undefined
    );
    const duplicated = morphs.duplicatedKeys ?? [];
    if (duplicated.length > 0)
      kv(shared, "duplicate keys in one screen", duplicated.join(", "), "bad");
    kv(shared, "camera", formatBool(morphs.camera));
    kv(shared, "ghosts", formatCount(morphs.ghosts));
    const residue =
      (morphs.strandedRoles ?? 0) +
      (morphs.strandedStandIns ?? 0) +
      (morphs.strandedGhosts ?? 0) +
      (morphs.layerResidue ?? 0) +
      (morphs.leakedSheetRules ?? 0);
    kv(
      shared,
      "residue at rest",
      residue === 0
        ? "clean"
        : `${formatCount(morphs.strandedRoles)} roles · ${formatCount(morphs.strandedStandIns)} stand-ins · ` +
            `${formatCount(morphs.strandedGhosts)} ghosts · ${formatCount(morphs.layerResidue)} in layer · ` +
            `${formatCount(morphs.leakedSheetRules)} rules`,
      residue > 0 ? "bad" : undefined
    );
  }

  // Tripwires are REPORTED events, not sampled ones: they cannot miss the
  // single frame they describe, which is why they get their own region.
  const hits = flight.tripwires ?? [];
  if (hits.length > 0) {
    const tripwires = section(node, "tripwires (one-frame events)");
    for (const hit of hits)
      line(tripwires, `+${formatMs(hit.atMs)} ${hit.kind}: ${hit.detail}`, "li bad");
  }

  const input = flight.input;
  if (input) {
    const drove = section(node, "what drove it");
    kv(
      drove,
      "input",
      `${formatCount(input.trusted)} trusted · ${formatCount(input.synthetic)} synthetic`,
      input.synthetic > 0 ? "bad" : undefined
    );
    kv(drove, "pointer types", input.pointerTypes?.join(", ") || "none observed");
  }

  // A still-loading image completing mid-flight decodes on the moving layer:
  // glass-measured at one skipped present per decode, which is why the engine
  // holds them. Completions beyond the held count are that regression.
  const images = section(node, "images");
  const completed = flight.images?.completedDuringFlight ?? 0;
  const held = flight.images?.heldDuringFlight ?? 0;
  const completedUnheld = flight.images?.completedUnheld;
  // Older/partial reports may not carry completedUnheld. Preserve the old
  // best-effort tone only for those; schema-v2 reports use the per-image
  // result so an unrelated held image cannot hide an unheld completion.
  const hasUnheldCompletion =
    typeof completedUnheld === "number" ? completedUnheld > 0 : completed > held;
  kv(images, "loading at t0", formatCount(flight.images?.loadingAtStart));
  kv(images, "added mid-flight", formatCount(flight.images?.addedDuringFlight));
  kv(
    images,
    "completed mid-flight",
    formatCount(flight.images?.completedDuringFlight),
    hasUnheldCompletion ? "bad" : undefined
  );
  kv(images, "held by the engine", formatCount(flight.images?.heldDuringFlight));
  kv(
    images,
    "completed without hold",
    formatCount(completedUnheld),
    hasUnheldCompletion ? "bad" : undefined
  );

  renderLongTasks(section(node, "long tasks"), flight);

  const landing = section(node, "landing");
  const residual = flight.landing?.residualInlineTransforms ?? [];
  if (residual.length === 0) {
    kv(landing, "inline residue", "clean");
  } else {
    for (const entry of residual) kv(landing, "inline residue", formatText(entry));
  }
  kv(landing, "off-viewport at rest", formatBool(flight.landing?.offViewportAtRest));
  const stuck = flight.landing?.stuckStatuses ?? [];
  kv(landing, "stuck statuses", stuck.length === 0 ? "none" : stuck.join(", "));
  const orphans = flight.landing?.orphanedHolds ?? [];
  if (orphans.length === 0) {
    kv(landing, "orphaned holds", "none");
  } else {
    for (const entry of orphans) kv(landing, "orphaned holds", formatText(entry), "bad");
  }

  const anomalies = section(node, "anomalies");
  const found = flight.anomalies ?? [];
  if (found.length === 0) {
    line(anomalies, "none", "li dim");
    return;
  }
  for (const anomaly of found) line(anomalies, formatText(anomaly), "li bad");
};

export const renderBlindSpots = (
  node: Element,
  blindSpots: readonly string[] | undefined
): void => {
  clear(node);
  for (const entry of blindSpots ?? []) line(node, formatText(entry));
};
