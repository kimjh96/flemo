// Tracks a shared bar's rendered height so the screen can reserve matching
// space in its layout. Reports the current height immediately when the bar is
// already laid out, then follows resizes. A measured height of 0 is IGNORED:
// it happens when the screen is frozen (display:none) during a transition, not
// because the bar shrank. Letting the reserved space collapse would grow the
// scroll area, and WebKit clamps scrollTop to the smaller max and does NOT
// restore it on unfreeze (scroll jumps up on short pages) — keeping the last
// real height keeps the reserved space stable across freeze/unfreeze.
// Framework-neutral: the binding feeds the element and stores the height.
export default function observeBarHeight(
  element: HTMLElement,
  onHeight: (height: number) => void
): () => void {
  if (element.offsetHeight > 0) onHeight(element.offsetHeight);
  const observer = new ResizeObserver(([entry]) => {
    if (entry.contentRect.height > 0) onHeight(entry.contentRect.height);
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
}
