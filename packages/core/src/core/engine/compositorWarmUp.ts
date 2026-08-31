import { WARM_ATTR } from "@dom/attributes";
// Compositor warm-up for the length of a flight.
//
// A transition normally starts from an IDLE browser: nothing has been
// animating, so the compositor is not producing frames on a vsync cadence and
// the motion's opening pays for spinning it up. Measured on the deep journey
// (Chrome, mobile emulation, 425x707) as a single lost frame one frame BEFORE
// the motion begins, on the large majority of flights — with no long task, no
// layout and no layer churn anywhere near it. The tell that named the cause:
// the loss disappears while a DevTools performance recording runs, because a
// recording forces a frame every vsync.
//
// So while any navigation is in flight, one 1-pixel invisible element runs a
// compositor animation, keeping the frame cadence alive right into the moment
// the real motion starts. It is reference-counted across engines (nested
// Routers transition together) and idles as soon as the last flight ends.
//
// The element is what a consumer SEES if any of this is wrong, and on
// 2026-08-31 one did: on an iPhone, in production, the patch was visible at the
// top-left corner in the moment before a transition. Two things were wrong and
// both are fixed below — the opacity was three composited levels rather than
// the imperceptible one this comment claimed, and the element used to be
// removed on release, so it POPPED IN again on every tap. Nothing about the
// frame forcing changed with either.
//
// The animation is driven by `element.animate`, NOT the compiled stylesheet:
// emitting keyframes into the sheet would break the contract that a `none`
// transition emits no rules.

export { WARM_ATTR } from "@dom/attributes";

// A flight that never reports its end (an engine torn down mid-transition)
// must not leave the element animating forever. Far longer than any real
// transition, so it never fires for a flight that ends normally.
const WARM_BACKSTOP_MS = 3000;

// RASTER-CLASS damage (2026-08-18): the original 1px translate produced
// composite-only frames, and the machine-level judder it targets survived it
// — while a DevTools FPS-counter overlay (whose digits REPAINT every frame)
// visibly cleared the same judder, the postmortem's own control. So the warm
// element now mirrors the counter's damage profile: a background-position
// sweep is main-thread painted, guaranteeing changed PIXELS (not just a
// recomposited quad) on every single frame for the flight's whole span.
const WARM_KEYFRAMES = [{ backgroundPosition: "0px 0px" }, { backgroundPosition: "48px 0px" }];

const WARM_TIMING: KeyframeAnimationOptions = {
  duration: 500,
  iterations: Infinity,
  direction: "alternate",
  easing: "linear"
};

// Invisible, inert, and out of flow: it must never affect layout, hit-testing
// or what the user sees. `position: fixed` keeps it out of the document flow
// without becoming an ancestor of anything, so no consumer's `position: fixed`
// descendant can have its containing block changed by it.
//
// The element MUST paint (a real background, not transparent): the compositor
// only presents a frame when the animation produces damage, and Blink refuses
// to composite animations with no visible change outright
// (kAnimationHasNoVisibleChange). A transparent 1px element paints nothing, so
// moving it damages nothing and the warm-up forces no frames — measured as
// exactly the judder-that-disappears-while-recording surviving the warm-up.
//
// OPACITY 0.006, down from 0.02 (2026-08-31). This comment used to call 0.02
// imperceptible and a consumer report falsified it. The arithmetic agrees:
// 0.02 of #808080 over white composites to 252/255, three levels of a flat
// square sitting exactly where an app puts its back button, and on an OLED
// black it is RGB(3,3,3) against true black. At 0.006 the same square is
// 254/255, under one quantization step in either direction.
//
// What is NOT reduced is the damage. The repaint follows the
// `background-position` change — the paint op moving — so it is never the
// contrast between the two gradient halves that forces the frame, and the two
// tones stay 16 levels apart only so a paint-op cache cannot treat the swept
// background as unchanged. Blink's kAnimationHasNoVisibleChange refusal is
// about COMPOSITOR animations; background-position is main-thread painted and
// was never subject to it.
const WARM_STYLE =
  "position:fixed;top:0;left:0;width:48px;height:48px;" +
  "pointer-events:none;opacity:0.006;" +
  "background-image:linear-gradient(90deg,#808080 0 24px,#909090 24px 48px);" +
  "background-repeat:repeat;background-size:48px 48px;";

// RESIDENT once created, animation gated by the refcount (2026-08-31). The
// element used to be appended on the first hold and REMOVED on the last, which
// on touch meant a create/append/animate/remove cycle per tap: every tap paid
// DOM churn on the exact path that is about to navigate, and every tap
// re-introduced the patch as a POP-IN, which the eye catches far more readily
// than a resident one. The falsification record points the same way — only the
// session-permanent form of a warm ever survived a device A/B. So the element
// is built once and kept; `holders` drives `play`/`pause` and the attribute
// value, which is what a test or a report reads to tell a live warm from an
// idle one.
let element: HTMLElement | null = null;
let animation: Animation | null = null;
let holders = 0;

/** Stop forcing frames; the element itself stays for the session. */
const idle = () => {
  holders = 0;
  animation?.pause();
  element?.setAttribute(WARM_ATTR, "idle");
};

/* v8 ignore next 7 -- test hook: the element is session-resident by design, so
   a suite that exercises its creation needs the module state cleared between
   cases. */
export const resetCompositorWarmForTesting = (): void => {
  holders = 0;
  animation?.cancel();
  animation = null;
  element?.remove();
  element = null;
};

export default function holdCompositorWarm(): () => void {
  /* v8 ignore next 2 -- SSR guard: the test environment always has a body. */
  if (typeof document === "undefined" || !document.body) return () => {};
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return () => {};
  }

  holders += 1;
  // `isConnected`, not merely `element`: a resident element can be carried off
  // by anything that replaces the body's contents, and a module slot pointing
  // at a detached node would leave the warm-up permanently silent while every
  // hold still reported success. Rebuilding is the same cost the per-hold
  // lifecycle used to pay every time.
  if (element && !element.isConnected) {
    animation?.cancel();
    animation = null;
    element = null;
  }
  if (!element) {
    element = document.createElement("div");
    element.setAttribute(WARM_ATTR, "on");
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("style", WARM_STYLE);
    document.body.appendChild(element);
    try {
      animation = element.animate(WARM_KEYFRAMES, WARM_TIMING);
    } catch {
      // An engine that refuses the effect simply goes unwarmed; the element is
      // still harmless, and it never forces a frame either way.
      animation = null;
    }
  } else if (holders === 1) {
    element.setAttribute(WARM_ATTR, "on");
    animation?.play();
  }

  let released = false;
  const backstop = setTimeout(() => {
    /* v8 ignore next -- the release clears this timeout, so the timer can
       never fire on an already-released hold; kept as a re-entrancy guard. */
    if (released) return;
    released = true;
    holders -= 1;
    if (holders <= 0) idle();
  }, WARM_BACKSTOP_MS);

  return () => {
    if (released) return;
    released = true;
    clearTimeout(backstop);
    holders -= 1;
    if (holders <= 0) idle();
  };
}
