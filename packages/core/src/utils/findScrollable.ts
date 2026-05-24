export default function findScrollable(
  startTarget: EventTarget | null,
  options?: {
    direction?: "y" | "x";
    markerSelector?: string;
    depthLimit?: number;
    verifyByScroll?: boolean;
  }
): { element: HTMLElement | null; hasMarker: boolean } {
  const {
    direction = "x",
    markerSelector = "[data-swipe-at-edge]",
    depthLimit = 24,
    verifyByScroll = false
  } = options ?? {};

  const start = getStartElement(startTarget);
  if (!start) return { element: null, hasMarker: false };

  // Marker takes priority — an explicit `[data-swipe-at-edge]` ancestor is
  // the author's hand-picked scroll container for swipe gating.
  const marked = start.closest?.(markerSelector);
  if (marked instanceof HTMLElement) {
    if (
      overflowsAxis(marked, direction) &&
      (!verifyByScroll || canProgrammaticallyScroll(marked, direction))
    ) {
      return { element: marked, hasMarker: true };
    }
  }

  // Walk ancestors. We intentionally do NOT stop at `document.body` —
  // viewport-level scrolling commonly lives on `<html>` (`documentElement`),
  // so gating swipe-back on it is the correct behavior. The loop exits
  // naturally when `parentElement` returns null at the top.
  let element: HTMLElement | null = start;
  let depth = 0;
  while (element && depth < depthLimit) {
    if (
      overflowsAxis(element, direction) &&
      (!verifyByScroll || canProgrammaticallyScroll(element, direction))
    ) {
      return { element, hasMarker: false };
    }
    element = element.parentElement;
    depth++;
  }

  return { element: null, hasMarker: false };
}

function getStartElement(event: EventTarget | null): HTMLElement | null {
  if (!event) return null;
  // Prefer composedPath() to handle slotted / shadow-DOM events. Falls
  // through to a strict `instanceof HTMLElement` check so non-Element
  // targets (`document`, `window`, `Text`) safely return null rather than
  // crashing the ancestor walk on `.parentElement`.
  const anyEvt = event as unknown as Event;
  const path: EventTarget[] | undefined =
    typeof anyEvt.composedPath === "function" ? anyEvt.composedPath() : undefined;
  if (path && path.length) {
    for (const node of path) {
      if (node instanceof HTMLElement) return node;
    }
  }
  if (event instanceof HTMLElement) return event;
  return null;
}

/** Whether the element's content overflows the given axis (sub-pixel safe). */
export function overflowsAxis(element: HTMLElement, direction: "y" | "x"): boolean {
  if (direction === "y") {
    return element.scrollHeight - element.clientHeight > 1;
  } else {
    return element.scrollWidth - element.clientWidth > 1;
  }
}

/**
 * Whether the element actually scrolls on the given axis.
 *
 * Reads `overflowX` / `overflowY` from computed style — fast, read-only,
 * and free of side effects. The previous implementation probed by writing
 * to `scrollTop` / `scrollLeft` and reverting, which fired scroll events
 * and interfered with `scroll-snap` / `scroll-behavior: smooth` consumers
 * on every pointerdown that flowed through `findScrollable`.
 */
export function canProgrammaticallyScroll(element: HTMLElement, direction: "y" | "x"): boolean {
  if (!overflowsAxis(element, direction)) return false;
  if (typeof window === "undefined") return false;

  const style = window.getComputedStyle(element);
  const overflow = direction === "y" ? style.overflowY : style.overflowX;
  return overflow === "auto" || overflow === "scroll" || overflow === "overlay";
}
