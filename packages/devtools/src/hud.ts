import { createShadowHost, flightInProgress, resolveRecorder } from "./surface";

import type { FlemoReport, FlightRecord, FlightRecorderHandle } from "./types";

// THE ON-DEVICE READOUT.
//
// A PHONE HAS NO CONSOLE. Every hard defect in this project's history was
// finally pinned on a real device, and every one of those investigations began
// the same way: hand-building a little box that prints numbers on screen,
// shipping it to the phone, reading them off, and deleting it when the round
// was over. It was rebuilt at least three times. Each rebuild cost a build, a
// deploy and a round of the user's attention, and each one measured slightly
// different things, so the numbers were never comparable across campaigns.
//
// This is that box, kept. Design rules, all of them paid for:
//
//   * READABLE IN A PHOTOGRAPH. The user reports from the device by taking a
//     picture of it. Monospaced, high contrast, no colour-only meaning.
//   * NEVER REPAINTS DURING A FLIGHT. Same gate as the panel — an instrument
//     that repaints inside the transition reproduces the artifact it is
//     measuring (see surface.ts).
//   * ONE TAP, NO CHROME. Tap to expand from one line to the detail block, tap
//     again to collapse, long-press to cycle the comparison bucket. There is
//     no menu to find with a thumb while holding the phone in the other hand.
//   * NOTHING LIVE. It updates after a flight lands, never during, and it has
//     no animation of its own anywhere in its stylesheet.

export interface DevtoolsHudOptions {
  /** Recorder to read. Defaults to this package's `window.flemo`, else its own. */
  recorder?: FlightRecorderHandle;
  /** Where the strip sits. Default "top". */
  position?: "top" | "bottom";
  /** Start expanded. Default false (the one-line summary). */
  initialExpanded?: boolean;
  /** Labels the long-press cycles through. Default ["A", "B"]. */
  buckets?: string[];
}

export interface DevtoolsHudHandle {
  detach: () => void;
}

/** Refresh cadence at rest. A landed flight is visible within one tick. */
const REFRESH_MS = 500;
const LONG_PRESS_MS = 450;

const HUD_CSS = `
:host { all: initial; }
.root { all: initial; }
.hud {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
  padding: 6px 10px;
  border-radius: 8px;
  background: #0b0f14;
  color: #e8f0f8;
  border: 1px solid #2b3a4a;
  font: 500 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre;
  text-align: left;
  overflow-x: auto;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
  /* No transition and no keyframe anywhere in this sheet: the readout must
     never be a moving thing on a screen whose motion is under test. */
}
.hud[data-edge="top"] { top: max(8px, env(safe-area-inset-top)); }
.hud[data-edge="bottom"] { bottom: max(8px, env(safe-area-inset-bottom)); }
.hud[data-alarm="true"] { border-color: #ff6b6b; color: #ffd9d9; }
.hud[data-blocked="true"] { border-color: #ffb020; color: #ffe9c2; }
`;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const flightLine = (flight: FlightRecord | undefined): string => {
  if (!flight) return "flemo  no flight yet";
  const released = flight.frameSamples?.released;
  const alarm = flight.anomalies?.length ?? 0;
  return (
    `${flight.kind} ${Math.round(flight.durationMs)}ms  ` +
    `gap ${round1(released?.maxGapMs ?? 0)}  ` +
    `drop ${released?.over30Count ?? 0}` +
    (alarm > 0 ? `  !${alarm}` : "  ok") +
    (flight.bucket ? `  [${flight.bucket}]` : "")
  );
};

/**
 * The detail block. Every line answers a question that has actually been asked
 * of a device in this project, in the order they were asked: did it pace, did
 * it move, did the shared elements fly, what drove it, and what is wrong.
 */
const detailLines = (report: FlemoReport | null, flight: FlightRecord | undefined): string[] => {
  const lines: string[] = [];
  const blocked = (report?.preconditions ?? []).filter((check) => check.status === "violated");
  if (blocked.length > 0) {
    lines.push(`BLOCKED  ${blocked.map((check) => check.id).join(" ")}`);
  }
  if (!flight) {
    lines.push(`rAF ${round1(report?.environment?.rafCadence?.medianGapMs ?? 0)}ms`);
    return lines;
  }
  const frames = flight.frameSamples;
  lines.push(
    `frames  n${frames?.released?.count ?? 0} ` +
      `med ${round1(frames?.released?.medianGapMs ?? 0)} ` +
      `max ${round1(frames?.released?.maxGapMs ?? 0)}`
  );
  lines.push(
    `motion  stall ${round1(flight.motion?.longestStallMs ?? 0)}ms ` +
      `tail ${flight.motion?.tailFrames ?? 0} ` +
      `start +${flight.motion?.firstAnimationAtMs ?? "?"}ms`
  );
  lines.push(
    `hold    ${flight.holds?.kind ?? "none"} rel ${flight.holds?.releasedAtMs ?? "-"}ms  ` +
      `task ${flight.longTasks?.length ?? 0}`
  );
  const morphs = flight.morphs;
  if (morphs && (morphs.pairable.length > 0 || morphs.flew.length > 0)) {
    lines.push(
      `morph   ${morphs.flew.length}/${morphs.pairable.length} flew` +
        (morphs.camera ? " cam" : "") +
        (morphs.skipped.length > 0 ? `  SKIPPED ${morphs.skipped.join(",")}` : "")
    );
  }
  const input = flight.input;
  if (input) {
    lines.push(
      `input   ${input.pointerTypes.join("/") || "none"}` +
        (input.synthetic > 0 ? `  SYNTHETIC ${input.synthetic}` : "")
    );
  }
  for (const anomaly of flight.anomalies ?? []) lines.push(`! ${anomaly.slice(0, 120)}`);
  return lines;
};

let activeHud: DevtoolsHudHandle | null = null;

/**
 * Mount the on-device readout. Idempotent while mounted; inert without a DOM.
 */
export const attachDevtoolsHud = (options: DevtoolsHudOptions = {}): DevtoolsHudHandle => {
  if (activeHud) return activeHud;
  if (typeof document === "undefined") return { detach: () => {} };

  const { recorder, ownsRecorder } = resolveRecorder(options.recorder);
  const buckets = options.buckets && options.buckets.length > 0 ? options.buckets : ["A", "B"];
  const { host, root } = createShadowHost(HUD_CSS);
  const box = document.createElement("div");
  box.className = "hud";
  box.setAttribute("data-edge", options.position ?? "top");
  box.setAttribute("role", "status");
  box.textContent = "flemo  attaching";
  root.appendChild(box);

  let detached = false;
  let expanded = options.initialExpanded === true;
  let bucketIndex = -1;
  let timer = 0;
  let pressTimer = 0;
  let longPressed = false;
  let rendered = "";

  const readReport = (): FlemoReport | null => {
    try {
      return recorder.report();
    } catch {
      // A recorder that throws must not take the readout (or its timer) down.
      return null;
    }
  };

  const render = (): void => {
    if (detached || flightInProgress()) return;
    const report = readReport();
    const flights = report?.flights ?? [];
    const last = flights[flights.length - 1];
    const lines = [flightLine(last)];
    if (expanded) lines.push(...detailLines(report, last));
    const text = lines.join("\n");
    const blocked = (report?.preconditions ?? []).some((check) => check.status === "violated");
    const alarm = (last?.anomalies?.length ?? 0) > 0;
    // Written only when it actually changed: the whole point of this surface
    // is to be inert between flights.
    if (text !== rendered) {
      rendered = text;
      box.textContent = text;
    }
    box.setAttribute("data-alarm", alarm ? "true" : "false");
    box.setAttribute("data-blocked", blocked ? "true" : "false");
  };

  const tick = (): void => {
    timer = 0;
    render();
    timer = window.setTimeout(tick, REFRESH_MS);
  };

  const cycleBucket = (): void => {
    bucketIndex = bucketIndex + 1 >= buckets.length ? -1 : bucketIndex + 1;
    recorder.mark(bucketIndex === -1 ? null : buckets[bucketIndex]);
    rendered = "";
    render();
  };

  const onPointerDown = (): void => {
    longPressed = false;
    window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      longPressed = true;
      cycleBucket();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = (): void => {
    window.clearTimeout(pressTimer);
    pressTimer = 0;
    if (longPressed) return;
    expanded = !expanded;
    rendered = "";
    render();
  };

  box.addEventListener("pointerdown", onPointerDown);
  box.addEventListener("pointerup", onPointerUp);
  box.addEventListener("pointercancel", () => window.clearTimeout(pressTimer));

  const detach = (): void => {
    if (detached) return;
    detached = true;
    window.clearTimeout(timer);
    timer = 0;
    window.clearTimeout(pressTimer);
    pressTimer = 0;
    host.remove();
    if (ownsRecorder) recorder.detach();
    activeHud = null;
  };

  document.body.appendChild(host);
  render();
  timer = window.setTimeout(tick, REFRESH_MS);

  const handle: DevtoolsHudHandle = { detach };
  activeHud = handle;
  return handle;
};
