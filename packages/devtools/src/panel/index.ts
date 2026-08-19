// The visual panel for @flemo/devtools.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE: the panel must never touch the
// DOM while a flight is in progress.
//
// This project spent weeks chasing a stutter that was finally attributed to
// DevTools being OPEN (inspector overhead + panel repaints) rather than to
// anything in the library — hence the "judge with DevTools closed" protocol
// this package reports through `judgingProtocol`. A measurement surface that
// repaints, reflows or animates during a transition reproduces that exact
// artifact and then reports it as a finding. So:
//
//   * refreshes are polled on a setTimeout chain (never a persistent rAF
//     loop — that would compete for the same frames the motion needs),
//   * every refresh is SKIPPED while any screen carries a transitional
//     data-flemo-status, and retried on the next tick,
//   * closed (the default) means one cheap idle tick that only updates the
//     toggle's badge,
//   * the stylesheet carries no transitions and no keyframes at all
//     (packages/devtools/src/panel/styles.ts explains why not even the
//     hover polish).
//
// Do not "improve" this into a live-updating dashboard. The instrument that
// perturbs the measurement is worse than no instrument.

import { attachFlightRecorder } from "../recorder";
import { el, setText } from "./dom";
import { DASH, environmentSummary, flightListSignature } from "./format";
import { PANEL_CSS } from "./styles";
import { renderBlindSpots, renderChips, renderFlightDetail, renderFlightList } from "./view";

import type { FlemoGlobal } from "../recorder";
import type { FlemoReport, FlightRecorderHandle } from "../types";

export interface DevtoolsPanelOptions {
  /**
   * Recorder to read. Defaults to this package's `window.flemo` when one is
   * installed, otherwise the panel attaches its own and detaches it with
   * itself.
   */
  recorder?: FlightRecorderHandle;
  /** Start with the panel expanded. Default false (toggle button only). */
  initialOpen?: boolean;
  /** Corner for the toggle button. Default "bottom-right". */
  position?: "bottom-right" | "bottom-left";
}

export interface DevtoolsPanelHandle {
  detach: () => void;
}

/** Any screen mid-transition: while this matches, the panel stays frozen. */
const IN_FLIGHT_SELECTOR =
  '[data-flemo-screen][data-flemo-status="PUSHING"],' +
  '[data-flemo-screen][data-flemo-status="POPPING"],' +
  '[data-flemo-screen][data-flemo-status="REPLACING"]';

const HEIGHT_KEY = "flemo:devtools-panel-height";
/** ~3 refreshes/second while open — fast enough to feel live, far below the
 *  frame budget, and irrelevant anyway since refreshes never run in flight. */
const OPEN_REFRESH_MS = 320;
/** Closed: one badge update every 2s. */
const IDLE_REFRESH_MS = 2000;
const MIN_HEIGHT = 120;
const COPY_LABEL = "Copy report JSON";

const NOOP = () => {};

let activePanel: DevtoolsPanelHandle | null = null;

/**
 * Mount the devtools panel: a floating toggle plus a bottom drawer with the
 * flight list and per-flight detail, rendered into a shadow root so no
 * consumer CSS reaches in and none of ours reaches out.
 *
 * Idempotent — while a panel is mounted, further calls return the same
 * handle. In a non-DOM environment it returns an inert handle.
 */
export const attachDevtoolsPanel = (options: DevtoolsPanelOptions = {}): DevtoolsPanelHandle => {
  if (activePanel) return activePanel;
  if (typeof document === "undefined") return { detach: NOOP };

  // --- recorder --------------------------------------------------------
  let ownsRecorder = false;
  let recorder: FlightRecorderHandle;
  const installed = (window as unknown as { flemo?: Partial<FlemoGlobal> }).flemo;
  if (options.recorder) {
    recorder = options.recorder;
  } else if (installed?.__flemoDevtools === true && typeof installed.report === "function") {
    // Someone else's recorder (usually the playground's): read it, never
    // detach it.
    recorder = { report: installed.report, detach: NOOP };
  } else {
    // attachFlightRecorder is idempotent, so this adopts an already-attached
    // recorder that simply didn't install the global — and then takes it down
    // on detach(). Pass `recorder` explicitly to keep ownership.
    recorder = attachFlightRecorder();
    ownsRecorder = true;
  }

  // --- shell (built once) ----------------------------------------------
  const host = el("div");
  host.setAttribute("data-flemo-devtools-panel", "");
  // Zero-size fixed host: it participates in no layout, and its fixed
  // children position against the viewport. It carries no data-flemo-screen
  // attributes, so the recorder never sees the panel as a participant.
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483000";

  const shadow = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = PANEL_CSS;
  shadow.appendChild(style);
  const root = el("div", "root");
  shadow.appendChild(root);

  const toggle = el("button", "toggle");
  toggle.type = "button";
  toggle.setAttribute("data-corner", options.position ?? "bottom-right");
  toggle.setAttribute("aria-label", "flemo devtools");
  const flightCount = el("span", "count", "0");
  const anomalyDot = el("span", "dot");
  anomalyDot.hidden = true;
  toggle.appendChild(el("span", "mark", "flemo"));
  toggle.appendChild(flightCount);
  toggle.appendChild(anomalyDot);

  const panel = el("section", "panel");
  panel.hidden = true;
  const grip = el("div", "grip");
  grip.setAttribute("role", "separator");
  grip.setAttribute("aria-label", "Resize flemo devtools panel");
  const head = el("header", "head");
  const environment = el("div", "env", DASH);
  const copyButton = el("button", "act", COPY_LABEL);
  copyButton.type = "button";
  const closeButton = el("button", "act", "Close");
  closeButton.type = "button";
  const detachButton = el("button", "act", "Detach");
  detachButton.type = "button";
  const chips = el("div", "chips");
  head.appendChild(environment);
  head.appendChild(el("div", "spacer"));
  head.appendChild(copyButton);
  head.appendChild(closeButton);
  head.appendChild(detachButton);
  head.appendChild(chips);
  const body = el("div", "body");
  const list = el("div", "list");
  const detail = el("div", "detail");
  body.appendChild(list);
  body.appendChild(detail);
  const foot = el("div", "foot");
  const blindDetails = el("details");
  blindDetails.appendChild(el("summary", undefined, "What this cannot see"));
  const blindSpots = el("div");
  blindDetails.appendChild(blindSpots);
  foot.appendChild(blindDetails);
  panel.appendChild(grip);
  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(foot);
  root.appendChild(toggle);
  root.appendChild(panel);

  // --- state -----------------------------------------------------------
  let detached = false;
  let open = options.initialOpen === true;
  let selectedId: string | null = null;
  let listSignature = "";
  let detailSignature = "";
  let chipSignature = "";
  let blindRendered = false;
  let timer = 0;
  let copyTimer = 0;

  const clampHeight = (value: number): number =>
    Math.min(Math.max(value, MIN_HEIGHT), Math.max(MIN_HEIGHT, window.innerHeight * 0.9));

  const readStoredHeight = (): number | null => {
    try {
      const raw = sessionStorage.getItem(HEIGHT_KEY);
      if (raw === null) return null;
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  };

  const writeStoredHeight = (value: number): void => {
    try {
      sessionStorage.setItem(HEIGHT_KEY, String(Math.round(value)));
    } catch {
      // Storage denied (private mode / partitioned iframe): the height is
      // still applied for this session, it just won't be remembered.
    }
  };

  let height = clampHeight(readStoredHeight() ?? window.innerHeight * 0.4);
  panel.style.height = `${Math.round(height)}px`;

  const flightInProgress = (): boolean => document.querySelector(IN_FLIGHT_SELECTOR) !== null;

  const readReport = (): FlemoReport | null => {
    try {
      return recorder.report();
    } catch {
      // A recorder that throws must not take the panel (or its timer) down.
      return null;
    }
  };

  // --- rendering -------------------------------------------------------
  const select = (id: string): void => {
    if (id === selectedId) return;
    selectedId = id;
    requestRender();
  };

  const render = (): void => {
    const report = readReport();
    const flights = report?.flights ?? [];

    // The badge is the only thing that updates while the panel is closed.
    setText(flightCount, String(flights.length));
    const anomalous = flights.some((flight) => (flight?.anomalies?.length ?? 0) > 0);
    anomalyDot.hidden = !anomalous;
    panel.hidden = !open;
    if (!open) return;

    setText(environment, environmentSummary(report));

    const chipKey = JSON.stringify([
      report?.overrides?.warnings ?? [],
      report?.anomalies ?? [],
      report?.overrides?.active ?? {}
    ]);
    if (chipKey !== chipSignature) {
      chipSignature = chipKey;
      renderChips(chips, report);
    }

    // Selection is stable by id; only an empty selection auto-follows the
    // newest flight, so a refresh never yanks the pane you are reading.
    if (selectedId === null && flights.length > 0) {
      selectedId = flights[flights.length - 1]?.id ?? null;
    }

    const listKey = flightListSignature(flights, selectedId);
    if (listKey !== listSignature) {
      listSignature = listKey;
      renderFlightList(list, flights, selectedId, select);
    }

    const selected = flights.find((flight) => flight?.id === selectedId) ?? null;
    const detailKey = JSON.stringify(selected);
    if (detailKey !== detailSignature) {
      detailSignature = detailKey;
      renderFlightDetail(detail, selected);
    }

    if (!blindRendered) {
      blindRendered = true;
      renderBlindSpots(blindSpots, report?.blindSpots);
    }
  };

  function requestRender(): void {
    if (detached) return;
    // The whole point of this file: a flight is running, so we do nothing.
    // The next tick picks it up once the screens land.
    if (flightInProgress()) return;
    render();
  }

  // Timer ids are kept as plain numbers with 0 as "none", so every stop path
  // is an unconditional clearTimeout — no timer can survive detach() through
  // a missed branch.
  function tick(): void {
    timer = 0;
    requestRender();
    schedule();
  }

  function schedule(): void {
    timer = window.setTimeout(tick, open ? OPEN_REFRESH_MS : IDLE_REFRESH_MS);
  }

  const restart = (): void => {
    window.clearTimeout(timer);
    schedule();
  };

  const setOpen = (next: boolean): void => {
    open = next;
    restart();
    requestRender();
  };

  // --- interactions ----------------------------------------------------
  // User-initiated writes (toggling, selecting, copying) are exempt from the
  // freeze in the sense that the user asked for them — but they still route
  // through requestRender(), so a click landing mid-flight defers like
  // everything else.
  toggle.addEventListener("click", () => setOpen(!open));
  closeButton.addEventListener("click", () => setOpen(false));
  detachButton.addEventListener("click", () => detach());

  const markCopied = (): void => {
    if (detached) return;
    // The clipboard write resolves on its own schedule, which can be mid-
    // flight — and the label restore fires on a timer that has no idea
    // either. Both are DOM writes, so both wait exactly like a render does.
    if (flightInProgress()) {
      window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(markCopied, OPEN_REFRESH_MS);
      return;
    }
    setText(copyButton, "Copied ✓");
    window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(restoreCopyLabel, 1200);
  };

  // No detached guard: detach() clears this timer, so it cannot fire after
  // teardown. markCopied needs one because the clipboard promise CAN resolve
  // after detach; this cannot.
  function restoreCopyLabel(): void {
    if (flightInProgress()) {
      copyTimer = window.setTimeout(restoreCopyLabel, OPEN_REFRESH_MS);
      return;
    }
    copyTimer = 0;
    setText(copyButton, COPY_LABEL);
  }

  const fallbackCopy = (json: string): void => {
    // The async Clipboard API can reject after a navigation has started (or
    // after the panel detached). The legacy textarea path is still a DOM
    // write, so it follows the same flight gate as every other panel update.
    if (detached) return;
    if (flightInProgress()) {
      window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => fallbackCopy(json), OPEN_REFRESH_MS);
      return;
    }
    const area = el("textarea");
    area.value = json;
    area.setAttribute("aria-hidden", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.select();
    const legacy = document as unknown as { execCommand?: (command: string) => boolean };
    try {
      legacy.execCommand?.("copy");
    } catch {
      // Copy denied. The report is still reachable from the console via
      // window.flemo.report() — the panel is a convenience, not the only door.
    }
    area.remove();
    markCopied();
  };

  copyButton.addEventListener("click", () => {
    const json = JSON.stringify(readReport(), null, 2);
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard && typeof clipboard.writeText === "function") {
      void clipboard.writeText(json).then(markCopied, () => fallbackCopy(json));
      return;
    }
    fallbackCopy(json);
  });

  const onPointerMove = (event: { clientY: number }): void => {
    height = clampHeight(window.innerHeight - event.clientY);
    panel.style.height = `${Math.round(height)}px`;
  };

  const endDrag = (): void => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    writeStoredHeight(height);
  };

  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    // Window-level listeners rather than setPointerCapture: capture is
    // patchily implemented (and throws in some test environments) and buys
    // nothing here.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  });

  // --- lifecycle -------------------------------------------------------
  function detach(): void {
    if (detached) return;
    detached = true;
    window.clearTimeout(timer);
    timer = 0;
    window.clearTimeout(copyTimer);
    copyTimer = 0;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    host.remove();
    if (ownsRecorder) recorder.detach();
    activePanel = null;
  }

  document.body.appendChild(host);
  requestRender();
  schedule();

  const handle: DevtoolsPanelHandle = { detach };
  activePanel = handle;
  return handle;
};
