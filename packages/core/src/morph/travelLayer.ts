import { detectBlinkEngine } from "@platform/engineProbes";

// A TRAVELLING ELEMENT GETS A LAYER OF ITS OWN.
//
// A flight moves its element by `translate` (and a pinned pose by `transform`),
// driven through registered properties so the position stays on the thread its
// size is on (see morphPose). With no compositing layer of its own, the element
// is painted INTO its container's layer at that offset, and Blink paints a line
// of type on a whole device pixel vertically. So the travel reaches the glass
// rounded: in the slow end of a flight, where the curve moves a fraction of a
// pixel a frame, the text sat still for two or three frames and then jumped a
// pixel, while the card around it, and every screen transition, glided on the
// compositor. Measured on desktop Chrome from lossless compositor frames of the
// composition bench, the title's vertical steps through a push's last 300ms
// read +0.97, +0.99, 0, +0.95, 0, 0, +0.99, 0, 0, 0, +1.00 device px: the
// "trembling at the convergence" that no frame-timing instrument sees, because
// every one of those frames arrived on time.
//
// With a layer, the offset is applied when the layer is composited, fractional,
// and the same path reads +0.59, +0.49, +0.41, ..., +0.05, +0.03: the curve.
// That is the fractional glide the screens already make, with the same
// trade-off the postmortem records for them (a moving layer resamples its
// texture) chosen the same way.
//
// Blink only. WebKit's handling of a flight's layers is what froze Parts inside
// an arriving Morph on Safari, and nothing here has been looked at on WebKit.

/** Promote an element that a flight moves by `translate` or `transform`. */
export const promoteTravelLayer = (element: HTMLElement): void => {
  if (!detectBlinkEngine()) return;
  const current = element.style.willChange;
  if (/(^|,)\s*transform\s*(,|$)/.test(current)) return;
  element.style.willChange = current && current !== "auto" ? `${current}, transform` : "transform";
};
