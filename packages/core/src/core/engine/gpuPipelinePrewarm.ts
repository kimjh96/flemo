// One-shot GPU pipeline prewarm at boot.
//
// Chrome's Graphite rasterizer (Dawn → Metal/Vulkan) compiles its GPU
// pipelines LAZILY: the first draw that needs a given variant — a composited
// texture under an animating transform, a translucent quad blending over it —
// pays the compilation right there. A flight is exactly the first draw of
// those variants, so on a cold pipeline cache the compile lands INSIDE the
// motion (traced on the consumer machine, real Chrome: two
// `DawnPlatformImpl::RunWorkerTask` bursts blocking the GPU main thread for
// ~110ms and ~88ms, freezing the flight at 30-77% and 90-95% progress — the
// second burst is squarely the deceleration segment, and Chrome tags the
// dropped frames `affects_smoothness`). The cache is per browser profile and
// per binary version, so the stall recurs after every Chrome update, on every
// fresh profile, and on GPU-process restarts — always exactly once, which is
// why it evades observation: by the time a Performance recording is armed,
// the session's first flight has already compiled the pipelines and every
// recorded flight is clean. Safari never shows it (no Dawn).
//
// The interaction-scoped compositor warm (Router) wakes the FRAME PIPELINE —
// clock and power states — but its 1px solid probe never exercises these
// pipeline variants, so it cannot front-load the compiles. This module does:
// once per page, at idle, it mounts an imperceptible host (2% opacity, the
// compositor warm-up's own trick) carrying the flight's draw shapes — a
// textured layer WITH TEXT under a transform animation, and a translucent
// quad under an opacity animation — runs them for a few frames, and removes
// everything. Dawn compiles while the app is idle; the first flight then
// draws over warm pipelines end to end (verified by trace: the injected
// prewarm removed every in-flight compile burst on a cold profile).

import { detectBlinkEngine } from "@core/engine/driverPolicy";

const noop = () => {};

export const GPU_PREWARM_ATTR = "data-flemo-gpu-prewarm";

// How long the probes animate before teardown: enough presented frames for
// every draw to actually reach the GPU (the compile happens on first DRAW,
// not on style application), with margin over the 3×120ms animations.
export const PREWARM_SPAN_MS = 450;

// Idle scheduling. The prewarm is Blink-only (see the engine gate below), and
// Blink always ships requestIdleCallback, so the probe runs at genuine idle.
// A flight keeps the main thread busy, so rIC cannot fire "at idle" DURING a
// navigation — it would only fire at the TIMEOUT, so the timeout is set past
// a typical flight (a cupertino push is ~700ms): an early tap's motion
// completes before the timeout forces the run, keeping the compile burst out
// of the flight. The fallback delay covers the (Blink-improbable) no-rIC
// build; it is unreachable behind the gate on a real Chromium.
const IDLE_TIMEOUT_MS = 2000;
const FALLBACK_DELAY_MS = 1200;

const PROBE_ANIMATION_MS = 120;
const PROBE_ITERATIONS = 3;

// Invisible, inert, out of flow — the compositor warm-up's contract: the
// host must PAINT (transparent content compiles nothing and Blink refuses
// no-visible-change animations), and 2% opacity is imperceptible while still
// producing real draws of the real pipeline variants.
const HOST_STYLE = "position:fixed;top:0;left:0;pointer-events:none;opacity:0.02;";
const TEXTURED_LAYER_STYLE =
  "width:64px;height:64px;background:#888;color:#000;font-size:10px;" +
  "will-change:transform;transform:translate3d(1px,0,0);";
const TRANSLUCENT_LAYER_STYLE =
  "width:64px;height:64px;background:#000;will-change:opacity;opacity:0.5;";

// One shot per page lifetime: the pipelines outlive every Router, so a
// second prewarm would draw for nothing.
let state: "cold" | "scheduled" | "done" = "cold";
// Page-wide owner refcount: the pipelines outlive every Router, so the probe
// runs ONCE for the whole page, but any number of concurrent Routers may ask
// for it. The scheduled run is cancelled only when the LAST owner unmounts
// before it fires — an earlier model gave only the first caller a live
// disposer, so that caller's unmount cancelled the prewarm other mounted
// Routers still wanted, and a post-fire unmount tore the probe host down
// early. The host now tears ITSELF down on its own clock (run's removal
// timer), independent of any disposer.
let refs = 0;
let pendingSchedule: (() => void) | null = null;

/* v8 ignore next 4 -- test hook: state/refs are module-global and vitest
   shares the module graph across cases. */
export const resetGpuPipelinePrewarmForTesting = () => {
  if (pendingSchedule) pendingSchedule();
  pendingSchedule = null;
  state = "cold";
  refs = 0;
};

export default function ensureGpuPipelinePrewarm(): () => void {
  /* v8 ignore next -- SSR guard: the test environment always has a body. */
  if (typeof document === "undefined" || !document.body) return noop;
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return noop;
  }
  // Graphite/Dawn is Chromium's rasterizer; the probe is pointless work on
  // any other engine. Gating to Blink also removes the no-rIC fallback race
  // (Blink always ships requestIdleCallback).
  if (!detectBlinkEngine()) return noop;

  refs += 1;

  if (state === "cold") {
    state = "scheduled";

    // A flemo transition in flight right now owns the main thread; running the
    // probe would collide its Dawn pipeline compile with the very motion the
    // prewarm exists to keep clean. requestIdleCallback fires in the short
    // idle gaps BETWEEN a flight's animation frames too, and its timeout can
    // force a run mid-flight — so run() re-checks here and reschedules until a
    // genuinely idle moment (no active flight). A perpetually-navigating page
    // never idles, but then the real flights warm the pipelines anyway, so
    // deferring indefinitely loses nothing.
    //
    // ACCEPTED trade-off, deliberately NOT handled: a navigation that starts
    // AFTER the probe attached (inside its 450ms span). Cancelling then would
    // retract nothing — the pipeline compiles are enqueued to the GPU process
    // at the probe's FIRST draw, and the rest of the span is cheap redraws of
    // already-compiled variants. The pre-start check above is the only moment
    // a decision has any effect, so a started probe simply completes.
    const isNavigationActive = () =>
      document.querySelector(
        '[data-flemo-status="PUSHING"],[data-flemo-status="POPPING"],[data-flemo-status="REPLACING"]'
      ) !== null;

    const schedule = () => {
      const idle =
        typeof requestIdleCallback === "function"
          ? requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
          : null;
      const fallback = idle === null ? setTimeout(run, FALLBACK_DELAY_MS) : null;
      pendingSchedule = () => {
        if (idle !== null && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
        if (fallback !== null) clearTimeout(fallback);
      };
    };

    const run = () => {
      if (isNavigationActive()) {
        schedule(); // a flight is running — try again at the next idle
        return;
      }
      pendingSchedule = null;
      state = "done";
      const host = document.createElement("div");
      host.setAttribute(GPU_PREWARM_ATTR, "");
      host.setAttribute("aria-hidden", "true");
      host.setAttribute("style", HOST_STYLE);
      const textured = document.createElement("div");
      textured.setAttribute("style", TEXTURED_LAYER_STYLE);
      textured.textContent = "flemo";
      const translucent = document.createElement("div");
      translucent.setAttribute("style", TRANSLUCENT_LAYER_STYLE);
      host.append(textured, translucent);
      document.body.appendChild(host);
      try {
        textured.animate(
          [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(2px,0,0)" }],
          { duration: PROBE_ANIMATION_MS, iterations: PROBE_ITERATIONS }
        );
        translucent.animate([{ opacity: 0.4 }, { opacity: 0.6 }], {
          duration: PROBE_ANIMATION_MS,
          iterations: PROBE_ITERATIONS
        });
      } catch {
        // An engine that refuses the effects still draws the styled layers
        // for the span — most variants compile from the static draws alone.
      }
      // Self-clocked teardown: independent of any Router's lifetime.
      setTimeout(() => host.remove(), PREWARM_SPAN_MS);
    };

    schedule();
  }

  let disposed = false;
  return () => {
    if (disposed) return; // idempotent per owner
    disposed = true;
    refs = Math.max(0, refs - 1);
    // Only the LAST owner leaving before the run fires cancels it (back to
    // cold so a later Router still prewarms). Once fired, the probe host owns
    // its own teardown; a disposer never cuts it short.
    if (refs === 0 && state === "scheduled") {
      pendingSchedule?.();
      pendingSchedule = null;
      state = "cold";
    }
  };
}
