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
// Routers transition together) and removed as soon as the last flight ends.
//
// The animation is driven by `element.animate`, NOT the compiled stylesheet:
// emitting keyframes into the sheet would break the contract that a `none`
// transition emits no rules.

export const WARM_ATTR = "data-flemo-warm";

// A flight that never reports its end (an engine torn down mid-transition)
// must not leave the element animating forever. Far longer than any real
// transition, so it never fires for a flight that ends normally.
const WARM_BACKSTOP_MS = 3000;

const WARM_KEYFRAMES = [
  { transform: "translate3d(0, 0, 0)" },
  { transform: "translate3d(1px, 0, 0)" }
];

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
// One painted pixel at 2% opacity is imperceptible but is real damage every
// frame.
const WARM_STYLE =
  "position:fixed;top:0;left:0;width:1px;height:1px;" +
  "pointer-events:none;opacity:0.02;background:#888;will-change:transform;";

let element: HTMLElement | null = null;
let animation: Animation | null = null;
let holders = 0;

const teardown = () => {
  holders = 0;
  animation?.cancel();
  animation = null;
  element?.remove();
  element = null;
};

export default function holdCompositorWarm(): () => void {
  if (typeof document === "undefined" || !document.body) return () => {};
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return () => {};
  }

  holders += 1;
  if (!element) {
    element = document.createElement("div");
    element.setAttribute(WARM_ATTR, "");
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("style", WARM_STYLE);
    document.body.appendChild(element);
    try {
      animation = element.animate(WARM_KEYFRAMES, WARM_TIMING);
    } catch {
      // An engine that refuses the effect simply goes unwarmed; the element is
      // still harmless, and the release below removes it.
      animation = null;
    }
  }

  let released = false;
  const backstop = setTimeout(() => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders <= 0) teardown();
  }, WARM_BACKSTOP_MS);

  return () => {
    if (released) return;
    released = true;
    clearTimeout(backstop);
    holders -= 1;
    if (holders <= 0) teardown();
  };
}
