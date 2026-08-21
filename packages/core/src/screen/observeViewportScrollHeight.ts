// The first non-zero measurement across the whole app becomes the baseline, so
// `changed` reports growth relative to the page's initial state (an open
// software keyboard) rather than absolute overflow. Module-level on purpose:
// every screen shares one baseline.
let initialViewportScrollHeight = 0;

// The latest measurement, plus whether anything has measured at all. One
// observer serves every subscriber, so this IS the app-wide truth for as long
// as at least one subscriber is attached — and every mounted stack always has
// one, since the active screen is never frozen.
//
// Why it is kept: a subscriber that attaches LATE must start from the current
// value, not from its own. React's <Activity> freeze disconnects a covered
// screen's effects — so its subscription goes away — while its state SURVIVES.
// A screen frozen while the keyboard was open therefore woke up still believing
// the keyboard was open (its `viewportScrollHeight` state), and the binding
// hides the shared bottom bar and the system-navigation bar on that belief, and
// refuses swipe-back. Nothing corrected it: the observer only ever reported on
// a visualViewport event, and the event that closed the keyboard fired while
// the screen was frozen. The shared bar simply stayed gone — after any push
// that opened a keyboard, for the whole life of the screen, until some later
// keyboard or viewport resize happened to fire.
let lastViewportScrollHeight = 0;
let lastChangedViewportScrollHeight = 0;
let measured = false;

type ViewportScrollHeightListener = (
  viewportScrollHeight: number,
  changedViewportScrollHeight: number
) => void;

const listeners = new Set<ViewportScrollHeightListener>();
let rafId = 0;

const measure = () => {
  let newViewportScrollHeight =
    document.documentElement.scrollHeight - (window.visualViewport?.height || 0);
  newViewportScrollHeight = newViewportScrollHeight < 0 ? 0 : newViewportScrollHeight;
  let newChangedViewportScrollHeight = newViewportScrollHeight - initialViewportScrollHeight;
  newChangedViewportScrollHeight =
    newChangedViewportScrollHeight < 0 ? 0 : newChangedViewportScrollHeight;

  if (!initialViewportScrollHeight) {
    initialViewportScrollHeight = newViewportScrollHeight;
  }

  lastViewportScrollHeight = newViewportScrollHeight;
  lastChangedViewportScrollHeight = newChangedViewportScrollHeight;
  measured = true;

  // Copy: a listener disposing itself mid-notification (a screen unmounting on
  // the same keyboard event) must not skip the next one.
  for (const listener of [...listeners]) {
    listener(newViewportScrollHeight, newChangedViewportScrollHeight);
  }
};

const handleResize = () => {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(measure);
};

// Test seam: the module state above is app-wide by design (one baseline, one
// measurement, one registration), so a suite that wants an isolated session
// clears it here instead of reasoning about the order its cases ran in.
export function resetViewportScrollHeightForTesting() {
  listeners.clear();
  initialViewportScrollHeight = 0;
  lastViewportScrollHeight = 0;
  lastChangedViewportScrollHeight = 0;
  measured = false;
  window.visualViewport?.removeEventListener("resize", handleResize);
  window.visualViewport?.removeEventListener("scroll", handleResize);
}

// Watches how far the visual viewport falls short of the document (the
// software-keyboard signal on mobile). Coalesces the visualViewport's
// resize/scroll bursts into one rAF-batched measurement and reports
// `(viewportScrollHeight, changedViewportScrollHeight)`, both clamped at 0.
// One measurement serves every subscriber, so a stack of N screens costs one
// layout read per burst instead of N.
// Framework-neutral; DOM-only, so bindings must call it from a client-side
// lifecycle (an effect), never during SSR.
export default function observeViewportScrollHeight(
  onChange: ViewportScrollHeightListener
): () => void {
  const cold = listeners.size === 0;
  listeners.add(onChange);

  if (cold) {
    window.visualViewport?.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("scroll", handleResize);
  }

  // Before the first measurement (app boot) stay silent and leave the first
  // answer to the first viewport event, exactly as before. Measuring here
  // instead would call a shortfall on every load — on mobile the layout
  // viewport routinely exceeds the visual one with no keyboard in sight — and
  // hide the very bars this fix exists to keep.
  if (measured) {
    // Otherwise the app HAS a current shortfall, and this subscriber must
    // start from it rather than from its own (possibly frozen-stale) state.
    onChange(lastViewportScrollHeight, lastChangedViewportScrollHeight);
    // A cold attach means the window between the last disposal and now had no
    // observer, so the value just handed over could predate an event nobody
    // saw: re-measure on the usual rAF so it self-corrects within a frame. A
    // warm attach needs no such check — a live observer has been tracking all
    // along, which is the case that matters here (a woken screen re-subscribes
    // while the screen above it is still live and observing).
    if (cold) handleResize();
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size > 0) return;
    cancelAnimationFrame(rafId);
    window.visualViewport?.removeEventListener("resize", handleResize);
    window.visualViewport?.removeEventListener("scroll", handleResize);
  };
}
