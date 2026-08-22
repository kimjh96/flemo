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

import { steadySixtyDesktopProfile } from "@core/engine/steadySixtyCadence";

export const WARM_ATTR = "data-flemo-warm";

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
// One painted pixel at 2% opacity is imperceptible but is real damage every
// frame.
const WARM_STYLE =
  "position:fixed;top:0;left:0;width:48px;height:48px;" +
  "pointer-events:none;opacity:0.02;" +
  "background-image:linear-gradient(90deg,#808080 0 24px,#909090 24px 48px);" +
  "background-repeat:repeat;background-size:48px 48px;";

// VIZ-level cadence lock (2026-08-18): the DevTools FPS-counter overlay -
// drawn by the GPU process itself - was the one measured intervention that
// cleared this machine's residual present judder (postmortem 2026-08-16),
// and RENDERER-level damage (1px..48px, raster-class) did not replicate it.
// The only viz-level surface a web page can contribute is VIDEO: decoded on
// media threads, composited by viz at the video's own cadence, independent
// of both the main thread and the renderer's frame production. A 2KB 8x8
// 60fps loop plays for exactly the flight span (same holders as the warm
// element). Blink only composites a video it considers visible, so it sits
// at the warm element's 2% opacity, out of flow and inert.
const WARM_VIDEO_SRC =
  "data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAeuEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggExTbuMU6uEHFO7a1Osggdg7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjMuMS4xMDBXQYxMYXZmNjMuMS4xMDBEiYhAj0AAAAAAABZUrmvWrgEAAAAAAABN14EBc8WIPqUZMMrLeHecgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4P+UCrgkLCBCLqBCJqBAlWwhFW5gQFV7oEA7AEAAAAAAAACAAASVMNn+nNzn2PAgGfImUWjh0VOQ09ERVJEh4xMYXZmNjMuMS4xMDBzc9VjwItjxYg+pRkwyst4d2fIoEWjh0VOQ09ERVJEh5NMYXZjNjMuMS4xMDAgbGlidnB4Z8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMS4wMDAwMDAwMDAAH0O2dUWq54EAo5+BAACAEAIAnQEqCAAIAABHCIWFiIWEiAICAAYZaAAAo5WBABEAsQEAARAQABgAGG/0DAAEAACjlYEAIQCxAQABEBAAGAAYb/QMAAQAAKOVgQAyALEBAAEQEAAYABhv9AwABAAAo5WBAEMAsQEAARAQABgAGG/0DAAEAACjlYEAUwCxAQABEBAAGAAYb/QMAAQAAKOVgQBkALEBAAEQEAAYABhv9AwABAAAo5SBAHUAkQEAARAQFGAAYb/QMAAQAKOXgQCFALEBAAEQEAAYADA/9AwAAAD+aACjlYEAlgCxAQABEBAAGAAYb/QMAAQAAKOXgQCnALEBAAEQEAAYADA/9AwAAAD+aACjlYEAtwCxAQABEBAAGAAYb/QMAAQAAKOXgQDIALEBAAEQEAAYADA/9AwAAAD+aACjl4EA2QCxAQABEBAAGAAwP/QMAAAA/mgAo5WBAOkAsQEAARAQFGAAYWC/0AAgAACjn4EA+oAQAgCdASoIAAgAAEcIhYWIhYSIAgIABhloAACjl4EBCwCxAQABEBAAGAAwP/QMAAAA/mgAo5WBARsAsQEAARAQABgAGG/0DAAEAACjl4EBLACxAQABEBAAGAAwP/QMAAAA/mgAo5WBAT0AsQEAARAQABgAGG/0DAAEAACjl4EBTQCxAQABEBAAGAAwP/QMAAAA/mgAo5eBAV4AsQEAARAQABgAMD/0DAAAAP5oAKOVgQFvALEBAAEQEBRgAGFgv9AAIAAAo5+BAX+AEAIAnQEqCAAIAABHCIWFiIWEiAICAAYZaAAAo5eBAZAAsQEAARAQABgAMD/0DAAAAP5oAKOVgQGhALEBAAEQEAAYABhv9AwABAAAo5WBAbEAsQEAARAQABgAGG/0DAAEAACjlYEBwgCxAQABEBAAGAAYb/QMAAQAAKOXgQHTALEBAAEQEAAYADA/9AwAAAD+aACjlYEB4wCxAQABEBAAGAAYb/QMAAQAAKOWgQH0AJEBAAEQEBRgAMD/0DAAAP5oAKOVgQIFALEBAAEQEAAYABhv9AwABAAAo5WBAhUAsQEAARAQABgAGFgYL+gMAACjlYECJgCxAQABEBAAGAAYWBgv6AwAAKOVgQI3ALEBAAEQEAAYABhYGC/oDAAAo5WBAkcAsQEAARAQABgAGFgYL+gMAACjlYECWACxAQABEBAAGAAYWBgv6AwAAKOfgQJpgBACAJ0BKggACAAARwiFhYiFhIgCAgAGGWgAAKOXgQJ5ALEBAAEQEAAYADA/9AwAAAD+aACjlYECigCxAQABEBAAGAAYb/QMAAQAAKOXgQKbALEBAAEQEAAYADA/9AwAAAD+aACjl4ECqwCxAQABEBAAGAAwP/QMAAAA/mgAo5WBArwAsQEAARAQABgAGG/0DAAEAACjlYECzQCxAQABEBAAGAAYb/QMAAQAAKOWgQLdAJEBAAEQEBRgAMD/0DAAAP5oAKOVgQLuALEBAAEQEAAYABhv9AwABAAAo5WBAv8AsQEAARAQABgAGFgYL+gMAACjlYEDDwCxAQABEBAAGAAYWBgv6AwAAKOVgQMgALEBAAEQEAAYABhYGC/oDAAAo5WBAzEAsQEAARAQABgAGFgYGBgQAACjlYEDQQCxAQABEBAAGAAYWC/0AAgAAKOVgQNSALEBAAEQEBRgAGFgv9AAIAAAo5WBA2MAsQEAARAQABgAGFgv9AAIAACjlYEDcwCxAQABEBAAGAAYWC/0AAgAAKOVgQOEALEBAAEQEAAYABhYGBgYEAAAo5WBA5UAsQEAARAQABgAGFgYL+gMAACjlYEDpQCxAQABEBAAGAAYWBgYGBAAAKOVgQO2ALEBAAEQEAAYABhYGC/oDAAAo5WBA8cAsQEAARAQABgAGFgYGBgQAACjlYED1wCxAQABEBAAGAAYWBgv6AwAABxTu2vJu4+zgQC3iveBAfGCAbDwgQO7kLOB+reL94EB8YIBsPCCAW27kbOCAX+3i/eBAfGCAbDwggI3u5GzggJpt4v3gQHxggGw8IIDiA==";
let video: HTMLVideoElement | null = null;
// The video's visibility handler, kept so it can be detached again: the
// element outlives every hold, so an anonymous listener per creation would
// be unremovable. It closes over ITS element rather than reading the module
// slot, so it can never fire against a torn-down video.
let syncWarmVideoPlayback: (() => void) | null = null;
let element: HTMLElement | null = null;
let animation: Animation | null = null;
let holders = 0;

const teardown = () => {
  holders = 0;
  animation?.cancel();
  animation = null;
  element?.remove();
  element = null;
  // The cadence-lock video is deliberately NOT torn down (see its creation
  // note): it is session-persistent on the platforms that get one — but the
  // flight-scoped forcing size shrinks back to the idle tick.
};

/* v8 ignore next 7 -- test hook: the cadence video is session-persistent by
   design, so a suite that exercises its creation needs the module state
   cleared between cases. */
export const resetCompositorWarmForTesting = (): void => {
  teardown();
  if (syncWarmVideoPlayback) {
    document.removeEventListener("visibilitychange", syncWarmVideoPlayback);
    syncWarmVideoPlayback = null;
  }
  video?.remove();
  video = null;
};

export default function holdCompositorWarm(): () => void {
  /* v8 ignore next 2 -- SSR guard: the test environment always has a body. */
  if (typeof document === "undefined" || !document.body) return () => {};
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return () => {};
  }

  holders += 1;
  // NOT a flight-scoped forcing surface. The observer-effect round tried
  // growing this video to a large quad (40vw) during the flight to mimic what
  // a running screen capture does to WindowServer's composition pacing; it was
  // falsified on device (it never replicated the capture effect and added
  // layer churn per interaction) and only the resident 8px tick survived.
  // See docs/postmortems/2026-08-motion-jank.md — do not re-add the resize.
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
    // The viz-level cadence lock (see WARM_VIDEO_SRC) — steady-60 desktops
    // only, and SESSION-PERSISTENT once created: tearing it down at settle
    // and re-creating it on the next tap reintroduced a pacing transient at
    // exactly the flight boundaries (live-judged "전환 간 끊김" after the
    // per-flight version already helped), and a first frame takes ~100ms to
    // reach the compositor — an opening the per-flight lifecycle left
    // uncovered. It pauses while the document is hidden. Failures are
    // silent: an engine without webm/autoplay keeps the element-only warm-up.
    if (!video && steadySixtyDesktopProfile()) {
      try {
        video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute("aria-hidden", "true");
        // NOT the WARM_ATTR: the element is the warm-up's public contract
        // (tests and diagnostics count it); the video is an internal auxiliary.
        video.setAttribute("data-flemo-warm-video", "");
        video.setAttribute(
          "style",
          "position:fixed;top:0;left:52px;width:8px;height:8px;pointer-events:none;opacity:0.02;"
        );
        video.src = WARM_VIDEO_SRC;
        document.body.appendChild(video);
        void video.play()?.catch?.(() => {});
        const media = video;
        syncWarmVideoPlayback = () => {
          if (document.visibilityState === "hidden") media.pause();
          else void media.play()?.catch?.(() => {});
        };
        document.addEventListener("visibilitychange", syncWarmVideoPlayback);
      } catch {
        video = null;
      }
    }
  }

  let released = false;
  const backstop = setTimeout(() => {
    /* v8 ignore next -- the release clears this timeout, so the timer can
       never fire on an already-released hold; kept as a re-entrancy guard. */
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
