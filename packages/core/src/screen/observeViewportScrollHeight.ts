// The first non-zero measurement across the whole app becomes the baseline, so
// `changed` reports growth relative to the page's initial state (an open
// software keyboard) rather than absolute overflow. Module-level on purpose:
// every screen shares one baseline.
let initialViewportScrollHeight = 0;

// Watches how far the visual viewport falls short of the document (the
// software-keyboard signal on mobile). Coalesces the visualViewport's
// resize/scroll bursts into one rAF-batched measurement and reports
// `(viewportScrollHeight, changedViewportScrollHeight)`, both clamped at 0.
// Framework-neutral; DOM-only, so bindings must call it from a client-side
// lifecycle (an effect), never during SSR.
export default function observeViewportScrollHeight(
  onChange: (viewportScrollHeight: number, changedViewportScrollHeight: number) => void
): () => void {
  let rafId = 0;

  const handleResize = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      let newViewportScrollHeight =
        document.documentElement.scrollHeight - (window.visualViewport?.height || 0);
      newViewportScrollHeight = newViewportScrollHeight < 0 ? 0 : newViewportScrollHeight;
      let newChangedViewportScrollHeight = newViewportScrollHeight - initialViewportScrollHeight;
      newChangedViewportScrollHeight =
        newChangedViewportScrollHeight < 0 ? 0 : newChangedViewportScrollHeight;

      if (!initialViewportScrollHeight) {
        initialViewportScrollHeight = newViewportScrollHeight;
      }

      onChange(newViewportScrollHeight, newChangedViewportScrollHeight);
    });
  };

  window.visualViewport?.addEventListener("resize", handleResize);
  window.visualViewport?.addEventListener("scroll", handleResize);

  return () => {
    cancelAnimationFrame(rafId);
    window.visualViewport?.removeEventListener("resize", handleResize);
    window.visualViewport?.removeEventListener("scroll", handleResize);
  };
}
