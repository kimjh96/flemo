// HOW MUCH OF THE LAYOUT VIEWPORT THE SOFTWARE KEYBOARD COVERS, in CSS pixels.
//
// This is the number a `position: fixed` element needs to sit ON the keyboard:
// fixed elements are laid out against the LAYOUT viewport, which the keyboard
// does not resize, so pinning to `bottom: 0` puts them behind it. Offsetting by
// this inset puts them exactly above it.
//
//     inset = innerHeight - (visualViewport.height + visualViewport.offsetTop)
//
// `offsetTop` matters because the visual viewport also SLIDES: when the page
// scrolls a focused field into view the visual viewport moves down inside the
// layout viewport, and without that term the inset would shrink by however far
// it slid and the pinned element would drift into the keyboard.
//
// Why not `observeViewportScrollHeight`'s number: that one measures the
// document against the visual viewport, so it also counts ordinary page
// overflow — useful as "is something covering the viewport", useless as a
// distance to offset by.
//
// WHAT THE INSET DOES DURING THE KEYBOARD'S SLIDE, measured on an iPhone:
// the page gets ONE value, already final, about 150ms after the field was
// focused — and it is barely running while that happens (frames stalled 139ms
// in the measured window). There are no intermediate heights to follow, on any
// of the three ways of applying them (`bottom`, a transform, or a box anchored
// to the visual viewport — all three land at the same time).
//
// So this reports the value the moment it arrives and does not soften it: an
// easing of our own would start after the platform unfroze, which is when the
// keyboard is nearly up, and would therefore arrive LATE. A consumer who
// prefers softness over accuracy can add a transition; the default should be
// the honest position.
//
// Chrome does report the geometry as it changes, and a keyboard that resizes
// while it stays open (emoji panel, suggestion bar) is reported everywhere,
// since that fires a viewport resize like any other.
//
// Pinch-zoom makes the formula meaningless (the visual viewport shrinks with
// scale, which would read as a giant keyboard), so a zoomed page reports 0 —
// the pinned element returns to its resting place rather than jumping to a
// fabricated one.
const ZOOM_EPSILON = 0.01;

// An app can ask Chrome to stop resizing anything and hand it the keyboard's
// geometry instead (`navigator.virtualKeyboard.overlaysContent = true`). In
// that mode the visual viewport does NOT shrink, so the formula above reads 0
// and a pinned element sits behind a keyboard it cannot see. Read the geometry
// the app opted into instead. flemo never sets `overlaysContent` itself: it
// changes how the whole page responds to the keyboard, which belongs to the
// app, not to a measurement.
interface VirtualKeyboardLike {
  overlaysContent: boolean;
  boundingRect: DOMRect;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

const virtualKeyboard = (): VirtualKeyboardLike | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const candidate = (navigator as Navigator & { virtualKeyboard?: VirtualKeyboardLike })
    .virtualKeyboard;
  return candidate?.overlaysContent ? candidate : undefined;
};

// Browser chrome that grows or shrinks (the collapsing URL bar) moves these
// numbers by a few pixels with no keyboard involved. Anything under this is
// treated as no keyboard at all.
const KEYBOARD_MIN_INSET_PX = 24;

export const measureKeyboardInset = (): number => {
  const keyboard = virtualKeyboard();
  if (keyboard) {
    const height = keyboard.boundingRect?.height || 0;
    return height < KEYBOARD_MIN_INSET_PX ? 0 : Math.round(height);
  }

  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
  if (!viewport) return 0;
  if (viewport.scale > 1 + ZOOM_EPSILON) return 0;

  const inset = window.innerHeight - (viewport.height + viewport.offsetTop);
  if (!Number.isFinite(inset) || inset < KEYBOARD_MIN_INSET_PX) return 0;
  return Math.round(inset);
};

type KeyboardInsetListener = (keyboardInset: number) => void;

// One observer for the whole app, for the same reasons as
// observeViewportScrollHeight: a stack of N screens costs one layout read per
// burst instead of N, and a subscriber that attaches LATE — a screen woken from
// <Activity> freeze, whose effects were disconnected while the keyboard opened
// or closed — is handed the current value instead of resuming a stale one.
const listeners = new Set<KeyboardInsetListener>();
let lastKeyboardInset = 0;
let measured = false;
let rafId = 0;

const measure = () => {
  const inset = measureKeyboardInset();
  lastKeyboardInset = inset;
  measured = true;

  // Copy: a listener disposing itself mid-notification (a screen unmounting on
  // the same keyboard event) must not skip the next one.
  for (const listener of [...listeners]) listener(inset);
};

const handleViewportChange = () => {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(measure);
};

// Whichever source this build has: the overlay geometry when the app opted
// into it, the visual viewport otherwise. Both are rAF-coalesced the same way.
const listen = (subscribe: boolean) => {
  const keyboard = virtualKeyboard();
  const method = subscribe ? "addEventListener" : "removeEventListener";
  if (keyboard) keyboard[method]("geometrychange", handleViewportChange);
  window.visualViewport?.[method]("resize", handleViewportChange);
  window.visualViewport?.[method]("scroll", handleViewportChange);
};

// Test seam: the module state above is app-wide by design, so a suite that
// wants an isolated session clears it here instead of reasoning about the order
// its cases ran in.
export function resetKeyboardInsetForTesting() {
  listeners.clear();
  lastKeyboardInset = 0;
  measured = false;
  rafId = 0;
  listen(false);
}

// Reports the keyboard inset whenever it changes. Coalesces the visualViewport's
// resize/scroll bursts into one rAF-batched measurement.
// Framework-neutral; DOM-only, so bindings must call it from a client-side
// lifecycle (an effect), never during SSR.
export default function observeKeyboardInset(onChange: KeyboardInsetListener): () => void {
  const cold = listeners.size === 0;
  listeners.add(onChange);

  if (cold) listen(true);

  // Unlike the shortfall measurement, measuring on attach is safe and wanted
  // here: the formula reads 0 for a page with no keyboard, so a subscriber
  // mounting mid-session (or into an already-open keyboard) starts correct
  // instead of waiting for the next viewport event.
  if (measured) {
    onChange(lastKeyboardInset);
    if (cold) handleViewportChange();
  } else {
    handleViewportChange();
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size > 0) return;
    cancelAnimationFrame(rafId);
    listen(false);
  };
}
