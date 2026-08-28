import { RIDE_HEIGHT_VAR } from "@transition/rideOffset";

// Publishes a screen's box height on the screen element, where the shared bars
// beside it inherit it. A bar's ride-along keyframes multiply this length
// instead of the bar's own height, which is what keeps a vertical transition's
// bar and screen travelling the same distance (see rideOffset.ts).
//
// Written imperatively, not through React state: this is a value the style
// system reads, never something a render decides, and a resize must not cost a
// re-render of the screen's whole subtree. Reported immediately when the
// element is already laid out, then followed.
//
// A height of 0 is IGNORED, on the same reasoning observeBarHeight documents: a
// frozen screen measures 0 and would otherwise publish a distance of nothing,
// collapsing the next flight's bar travel to zero. Keeping the last real height
// is right, because the box a frozen screen returns to is the one it left.
//
// Framework-neutral: the binding decides which element to publish on and when
// to stop.
export default function publishRideBox(element: HTMLElement): () => void {
  const write = (height: number) => {
    if (!(height > 0)) return;
    element.style.setProperty(RIDE_HEIGHT_VAR, `${height}px`);
  };

  write(element.offsetHeight);
  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    // The border box is what a percentage translate resolves against. Older
    // engines report only contentRect; a screen box carries no padding or
    // border, so the two agree wherever both exist.
    const border = entry.borderBoxSize?.[0]?.blockSize;
    write(typeof border === "number" ? border : entry.contentRect.height);
  });
  observer.observe(element);

  return () => {
    observer.disconnect();
    element.style.removeProperty(RIDE_HEIGHT_VAR);
  };
}
