import {
  attrSelector,
  attrValueSelector,
  DEVTOOLS_PANEL_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITIONAL_STATUSES
} from "./domProtocol";
import { attachFlightRecorder } from "./recorder";

import type { FlemoGlobal } from "./recorder";
import type { FlightRecorderHandle } from "./types";

// What every VISIBLE surface in this package shares.
//
// THE ONE RULE: a measurement surface must never touch the DOM while a flight
// is in progress. This project spent weeks chasing a stutter that was finally
// attributed to DevTools being OPEN — inspector overhead and panel repaints,
// not the library. A panel that repaints, reflows or animates during a
// transition reproduces that artifact and then reports it as a finding.
//
// So both surfaces (the drawer and the on-device readout) are built on this:
// the same in-flight gate, the same zero-sized shadow host that cannot join a
// flight, and the same recorder adoption rule.

/** Any screen mid-transition: while this matches, every surface stays frozen. */
export const IN_FLIGHT_SELECTOR = TRANSITIONAL_STATUSES.map(
  (status) => attrSelector(SCREEN_ATTR) + attrValueSelector(STATUS_ATTR, status)
).join(",");

export const flightInProgress = (): boolean => document.querySelector(IN_FLIGHT_SELECTOR) !== null;

export interface ShadowHost {
  host: HTMLElement;
  root: HTMLElement;
}

/**
 * A fixed, zero-sized host with an open shadow root.
 *
 * Zero-sized so it participates in no layout, and its fixed children position
 * against the viewport instead. It carries the devtools marker and NO
 * `data-flemo-*` screen attribute, so the recorder can never mistake its own
 * surface for a flight participant.
 */
/**
 * The palette and the type both surfaces are drawn in.
 *
 * ONE PALETTE, TWO SURFACES. The panel's toggle and the readout sit in
 * opposite corners of the same screen and were drawn from two different sets
 * of hardcoded colours, so they read as two tools that happened to land on the
 * same page. They are one tool. Dark first, because that is what an instrument
 * over a dark app should be, with the light scheme swapped in whole.
 */
export const SURFACE_TOKENS = `
:host {
  all: initial;
  color-scheme: dark;
}
* { box-sizing: border-box; }
.root {
  --bg: #14161a;
  --bg-soft: #1b1e24;
  --line: #2b3038;
  --fg: #e6e9ef;
  --fg-dim: #99a1b0;
  --accent: #7cc4ff;
  --warn: #ffb454;
  --bad: #ff6b6b;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--fg);
}
@media (prefers-color-scheme: light) {
  .root {
    --bg: #ffffff;
    --bg-soft: #f4f6f9;
    --line: #dde1e8;
    --fg: #1a1d22;
    --fg-dim: #5c6472;
    --accent: #0b6bcb;
    --warn: #a35a00;
    --bad: #c2261f;
  }
}
`;

export const createShadowHost = (css: string): ShadowHost => {
  const host = document.createElement("div");
  host.setAttribute(DEVTOOLS_PANEL_ATTR, "");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483000";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  shadow.appendChild(style);
  const root = document.createElement("div");
  root.className = "root";
  shadow.appendChild(root);
  return { host, root };
};

const NOOP = () => {};

/**
 * Which recorder a surface reads.
 *
 * Three cases, and the ownership question is the point of each: a recorder
 * handed in is the caller's and is never detached here; this package's own
 * `window.flemo` (usually an app's own recorder) is read but never taken down;
 * anything else means the surface attaches one and owns it. Getting this wrong
 * detaches the app's recorder when a panel closes, which loses the trace.
 */
export const resolveRecorder = (
  provided?: FlightRecorderHandle
): { recorder: FlightRecorderHandle; ownsRecorder: boolean } => {
  if (provided) return { recorder: provided, ownsRecorder: false };
  const installed = (window as unknown as { flemo?: Partial<FlemoGlobal> }).flemo;
  if (installed?.__flemoDevtools === true && typeof installed.report === "function") {
    return {
      recorder: {
        report: installed.report,
        detach: NOOP,
        mark: installed.mark ?? (() => null)
      },
      ownsRecorder: false
    };
  }
  // attachFlightRecorder is idempotent, so this adopts an already-attached
  // recorder that simply didn't install the global — and then takes it down
  // on detach(). Pass `recorder` explicitly to keep ownership.
  return { recorder: attachFlightRecorder(), ownsRecorder: true };
};
