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
//   * GETS OUT OF THE WAY. The readout stands on the screen whose motion is
//     under test, and the judging protocol for this project is to close the
//     instruments and drive the thing by hand. So it hides to a single small
//     control, and it remembers that across a reload: an instrument that comes
//     back every time the page reloads is one nobody turns off.
//   * NOTHING LIVE. It updates after a flight lands, never during, and it has
//     no animation of its own anywhere in its stylesheet.

/**
 * Where the readout docks.
 *
 * A corner keeps it clear of the middle of the screen, which is where the
 * motion being measured is. `"top"` and `"bottom"` are the centred strips this
 * started as.
 */
export type DevtoolsHudPosition =
  "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface DevtoolsHudOptions {
  /** Recorder to read. Defaults to this package's `window.flemo`, else its own. */
  recorder?: FlightRecorderHandle;
  /** Where the strip sits. Default "bottom-right", opposite the panel's toggle. */
  position?: DevtoolsHudPosition;
  /** Start expanded. Default false (the one-line summary). */
  initialExpanded?: boolean;
  /** Start hidden, leaving only the control. Default false, or whatever the last session chose. */
  initialHidden?: boolean;
  /** Labels the long-press cycles through. Default ["A", "B"]. */
  buckets?: string[];
}

export interface DevtoolsHudHandle {
  detach: () => void;
}

/** Refresh cadence at rest. A landed flight is visible within one tick. */
const REFRESH_MS = 500;
const LONG_PRESS_MS = 450;
/** Where the hidden/shown choice lives, so a reload does not undo it. */
export const HUD_HIDDEN_KEY = "flemo:devtools-hud-hidden";

const HUD_CSS = `
:host { all: initial; }
.root { all: initial; }
.dock {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  max-width: calc(100vw - 16px);
}
.dock[data-edge^="top"] {
  top: max(8px, env(safe-area-inset-top));
  /* The control sits nearest the edge the dock is anchored to, whichever that
     is, so it does not MOVE when the readout it hides collapses under it. A
     control that walks across the screen as you use it is one you have to look
     for, and the whole point of it is to be found with a thumb. */
  flex-direction: column-reverse;
}
.dock[data-edge^="bottom"] { bottom: max(8px, env(safe-area-inset-bottom)); }
.dock[data-edge="top"],
.dock[data-edge="bottom"] {
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.dock[data-edge$="-left"] {
  left: max(8px, env(safe-area-inset-left));
  align-items: flex-start;
}
.dock[data-edge$="-right"] { right: max(8px, env(safe-area-inset-right)); }
.hud {
  box-sizing: border-box;
  max-width: 100%;
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
.hud[hidden] { display: none; }
.hud[data-alarm="true"] { border-color: #ff6b6b; color: #ffd9d9; }
.hud[data-blocked="true"] { border-color: #ffb020; color: #ffe9c2; }
.eye {
  margin: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: #0b0f14;
  color: #8fa4b8;
  border: 1px solid #2b3a4a;
  font: 500 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}
.eye[data-hidden="true"] { color: #e8f0f8; }
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
    // COUNT WHAT FLEW, and name only what did not.
    //
    // This read `flew/pairable` for one round on a device and printed "3/0",
    // which looks like a failure and is not one: `pairable` only groups the
    // ends still sitting in their screens, and a pair the runtime had already
    // staged is proved by its role rather than by that grouping. A denominator
    // that is legitimately smaller than its numerator is a line nobody can
    // read on a phone.
    lines.push(
      `morph   ${morphs.flew.length} flew` +
        (morphs.camera ? " cam" : "") +
        (morphs.skipped.length > 0
          ? `  SKIPPED ${morphs.skipped.length} (${morphs.skipped.join(",")})`
          : "")
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

/**
 * The hidden choice, carried across a reload.
 *
 * `sessionStorage`, like the trace: a preference this instrument makes about
 * itself belongs to the session it was made in, and it has no business
 * outliving the tab. A storage that throws (a private window, a blocked
 * origin) simply means the readout starts shown.
 */
const readHidden = (): boolean => {
  try {
    return sessionStorage.getItem(HUD_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
};

const writeHidden = (hidden: boolean): void => {
  try {
    sessionStorage.setItem(HUD_HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // Nothing to do and nothing to report: the readout is on screen either way.
  }
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
  // UNDER THE PANEL, NOT OVER IT.
  //
  // Both surfaces dock along the bottom now, and the drawer is the one with
  // the detail. Left at the shared z-index the readout would float on top of
  // the drawer's own rows, an instrument arguing with itself.
  host.style.zIndex = "2147482998";
  const dock = document.createElement("div");
  dock.className = "dock";
  dock.setAttribute("data-edge", options.position ?? "bottom-right");
  const box = document.createElement("div");
  box.className = "hud";
  box.setAttribute("role", "status");
  box.textContent = "flemo  attaching";
  const eye = document.createElement("button");
  eye.className = "eye";
  eye.type = "button";
  dock.appendChild(box);
  dock.appendChild(eye);
  root.appendChild(dock);

  let detached = false;
  let expanded = options.initialExpanded === true;
  let hidden = options.initialHidden ?? readHidden();
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
    if (detached || hidden || flightInProgress()) return;
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

  /**
   * Show or hide the readout, and say so on the control.
   *
   * Hidden is INERT, not invisible: the poll stops with the box. The whole
   * claim this surface makes is that it costs nothing between flights, and a
   * hidden instrument that still wakes every half second twice a second is a
   * claim it would be making falsely.
   */
  const setHidden = (next: boolean): void => {
    hidden = next;
    box.hidden = next;
    eye.textContent = next ? "hud" : "hide";
    eye.setAttribute("data-hidden", next ? "true" : "false");
    eye.setAttribute("aria-label", next ? "show the flemo readout" : "hide the flemo readout");
    eye.setAttribute("aria-expanded", next ? "false" : "true");
    window.clearTimeout(timer);
    timer = 0;
    if (next) return;
    rendered = "";
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
  eye.addEventListener("click", () => {
    setHidden(!hidden);
    writeHidden(hidden);
  });

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
  setHidden(hidden);

  const handle: DevtoolsHudHandle = { detach };
  activeHud = handle;
  return handle;
};
