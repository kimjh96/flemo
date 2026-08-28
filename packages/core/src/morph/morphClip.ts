import { SCREEN_ATTR } from "@dom/attributes";

// WHAT THE SCROLLPORT WAS ALREADY HIDING.
//
// A pair's endpoint can sit half out of view: a cell scrolled to the list's
// edge is clipped by the scroll container, with the tab bar or the page's
// header stacked flush against that edge. The flight layer clips nothing, so
// the instant such an element is staged the hidden part PAINTS — a half cell
// becomes a whole one in one frame — and then the flight carries it straight
// across the chrome that was covering it. Reported from a scrolled grid as
// the morph "overlapping the tab bar and the header".
//
// The remedy is to carry the clip as part of the flight: measure how much of
// the endpoint's box its clipping ancestors actually showed, and interpolate
// from that inset to the other end's. Leaving, the element slides out from
// under the chrome instead of materialising over it; landing, it slides back
// under. The inset travels as a PERCENTAGE of the box, because the box is
// itself animating — a px inset correct at the source is the wrong fraction
// of every later size, while a percentage stays the fraction the eye saw.

/** Fraction of the box hidden on each side, as clip-path percentages. */
export interface MorphClipInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const clips = (overflow: string): boolean => overflow !== "" && overflow !== "visible";

/**
 * How much of the element's box its clipping ancestors cut away, per side, as
 * percentages of the box — or null when it is fully visible (within half a
 * pixel) or unmeasurable.
 *
 * Everything is read LIVE, from the element's own bounding rect — never from
 * a rest-space rect computed elsewhere. At staging time the element's screen
 * may already be mid-pose (a cupertino pop reads its revealed screen at
 * translate3d(-30%)), and mixing a rest-space element rect with mid-pose
 * ancestor boxes invents a cut the size of the pose: measured as a
 * destination cell reported 68.74% hidden on its right, which clipped the
 * flight to a sliver. Fractions of a box are invariant under the rigid
 * transforms screens fly by, so live-against-live reads the same answer the
 * rest layout will.
 */
export const visibleInset = (element: Element | null): MorphClipInset | null => {
  if (!element || !element.isConnected) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  let top = rect.y;
  let left = rect.x;
  let bottom = rect.y + rect.height;
  let right = rect.x + rect.width;
  // The walk STOPS AT THE ELEMENT'S OWN SCREEN. Live-against-live is only
  // pose-invariant for ancestors that move with the element; the first thing
  // outside the screen (the scope's own box, a stage bezel) holds still while
  // the screen flies, and measuring against it mid-pose reads the pose as a
  // cut — a cupertino pop's -30% slide became a 44% left inset, clipping the
  // returning artwork to a sliver. What hides list content is the scrollport,
  // and the scrollport lives inside the screen.
  for (
    let node = element.parentElement;
    node && !node.hasAttribute(SCREEN_ATTR);
    node = node.parentElement
  ) {
    let overflowX = "";
    let overflowY = "";
    try {
      const computed = getComputedStyle(node);
      overflowX = computed.overflowX;
      overflowY = computed.overflowY;
    } catch {
      return null;
    }
    if (!clips(overflowX) && !clips(overflowY)) continue;
    const box = node.getBoundingClientRect();
    // A zero-sized ancestor is jsdom or a display:contents artifact, not a
    // clip worth honouring.
    if (box.width <= 0 || box.height <= 0) continue;
    if (clips(overflowY)) {
      top = Math.max(top, box.top);
      bottom = Math.min(bottom, box.bottom);
    }
    if (clips(overflowX)) {
      left = Math.max(left, box.left);
      right = Math.min(right, box.right);
    }
  }
  const cutTop = top - rect.y;
  const cutLeft = left - rect.x;
  const cutBottom = rect.y + rect.height - bottom;
  const cutRight = rect.x + rect.width - right;
  if (cutTop < 0.5 && cutLeft < 0.5 && cutBottom < 0.5 && cutRight < 0.5) return null;
  const pct = (cut: number, span: number): number => Math.min(100, Math.max(0, (cut / span) * 100));
  return {
    top: pct(cutTop, rect.height),
    right: pct(cutRight, rect.width),
    bottom: pct(cutBottom, rect.height),
    left: pct(cutLeft, rect.width)
  };
};

const NONE: MorphClipInset = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The clip channel for a flight, or null when neither end was clipped —
 * inset(0) at every frame is not worth an animated property.
 */
export const clipTravel = (
  from: MorphClipInset | null,
  to: MorphClipInset | null
): { from: MorphClipInset; to: MorphClipInset } | null =>
  from === null && to === null ? null : { from: from ?? NONE, to: to ?? NONE };
