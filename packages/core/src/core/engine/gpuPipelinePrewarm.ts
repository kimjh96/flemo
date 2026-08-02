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

const noop = () => {};

export const GPU_PREWARM_ATTR = "data-flemo-gpu-prewarm";

// How long the probes animate before teardown: enough presented frames for
// every draw to actually reach the GPU (the compile happens on first DRAW,
// not on style application), with margin over the 3×120ms animations.
export const PREWARM_SPAN_MS = 450;

// Idle scheduling: prefer a real idle callback; without one, a short delay
// keeps the prewarm off the mount commit's critical path. Either way the
// work lands long before a human can produce the first navigation.
const IDLE_TIMEOUT_MS = 500;
const FALLBACK_DELAY_MS = 200;

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

/* v8 ignore next 2 -- test hook: state is module-global and vitest shares the
   module graph across cases. */
export const resetGpuPipelinePrewarmForTesting = () => {
  state = "cold";
};

export default function ensureGpuPipelinePrewarm(): () => void {
  /* v8 ignore next -- SSR guard: the test environment always has a body. */
  if (typeof document === "undefined" || !document.body) return noop;
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return noop;
  }
  if (state !== "cold") return noop;
  state = "scheduled";

  let host: HTMLElement | null = null;
  let removal: ReturnType<typeof setTimeout> | null = null;

  const teardown = () => {
    if (removal) clearTimeout(removal);
    removal = null;
    host?.remove();
    host = null;
  };

  const run = () => {
    state = "done";
    host = document.createElement("div");
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
      // An engine that refuses the effects still draws the styled layers for
      // the span — most of the variants compile from the static draws alone.
    }
    removal = setTimeout(teardown, PREWARM_SPAN_MS);
  };

  const idle =
    typeof requestIdleCallback === "function"
      ? requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
      : null;
  const fallback = idle === null ? setTimeout(run, FALLBACK_DELAY_MS) : null;

  return () => {
    // Disposed before firing (a Router unmounting immediately): cancel and
    // return to cold so a later Router still prewarms. After firing, the
    // probes finish their span on their own clock — done stays done.
    if (state === "scheduled") {
      if (idle !== null && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      if (fallback !== null) clearTimeout(fallback);
      state = "cold";
      return;
    }
    teardown();
  };
}
