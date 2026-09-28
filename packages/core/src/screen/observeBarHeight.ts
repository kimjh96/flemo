// Tracks a shared bar's rendered height so the screen can reserve matching
// space in its layout. Reports the current height immediately when the bar is
// already laid out, then follows resizes. A measured height of 0 is IGNORED:
// it happens when the screen is frozen (display:none) during a transition, not
// because the bar shrank. Letting the reserved space collapse would grow the
// scroll area, and WebKit clamps scrollTop to the smaller max and does NOT
// restore it on unfreeze (scroll jumps up on short pages) — keeping the last
// real height keeps the reserved space stable across freeze/unfreeze.
// Framework-neutral: the binding feeds the element and stores the height.
//
// ONE MEASURE, AND AN EXACT ONE.
//
// The first reading and every later one have to be the same quantity, or the
// reservation changes size while nothing about the bar did. The first was
// `offsetHeight`, which is the border box ROUNDED to a whole pixel, and the
// later ones were the observer's content box, fractional: a 63.5px tab bar
// reserved 64px when a screen arrived and 63.5px once the observer first
// reported, which was after the navigation had landed. The half pixel moved
// everything above the reservation, and at 2x that is a whole device row: a
// full-width line at the bottom of the list changed colour on the frames right
// after every tab switch settled, traced on desktop Chrome in every run.
//
// So both read the border box (the space the bar occupies, padding and border
// included) at its layout size: fractional, and untouched by a transform, which
// a riding bar or a zooming camera may be carrying while it is measured.

const px = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// A border with no style has no width, whatever the width property says. The
// computed value already honours that in a browser; asking the style too keeps
// the answer right wherever it does not.
const borderWidth = (width: string, style: string): number =>
  style === "none" || style === "hidden" ? 0 : px(width);

/** The bar's border-box height, fractional and at its layout size. */
export const readBarHeight = (element: HTMLElement): number => {
  const view = element.ownerDocument.defaultView;
  if (!view) return element.offsetHeight;
  const style = view.getComputedStyle(element);
  const height = px(style.height);
  if (style.boxSizing === "border-box") return height;
  return (
    height +
    px(style.paddingTop) +
    px(style.paddingBottom) +
    borderWidth(style.borderTopWidth, style.borderTopStyle) +
    borderWidth(style.borderBottomWidth, style.borderBottomStyle)
  );
};

export default function observeBarHeight(
  element: HTMLElement,
  onHeight: (height: number) => void
): () => void {
  const initial = readBarHeight(element);
  if (initial > 0) onHeight(initial);
  const observer = new ResizeObserver(([entry]) => {
    const height = entry.borderBoxSize?.[0]?.blockSize ?? readBarHeight(element);
    if (height > 0) onHeight(height);
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
}
