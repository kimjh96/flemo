// Flight-scoped image reveal hold — the image analog of responseHold.
//
// responseHold parks a mid-flight FETCH resolution and delivers it at rest, so
// the data reveal's React render can't starve the animation. But the pixels
// that arrive as <img> loads never travel through fetch: a screen's profile
// photo renders at mount with its src, then completes over the network
// mid-slide, and its load -> decode -> PAINT re-rasters the sliding composited
// layer. Device-measured on a detail push (the entering member photo): a
// 150-260ms raster block landing right after the settle gate releases, which
// the rAF player reads as a frame famine (the slide leaps) and the compiled
// tier can't escape either (it is that layer's OWN re-raster). Fetch-level
// parking cannot see it.
//
// So while a transition is in motion, an <img> that has NOT yet painted is held
// invisible and revealed in one batch at rest — the same reveal-at-rest model
// responseHold gives data. `decoding="async"` (the image decode offloader)
// still runs during the hold, so the reveal is a cheap composite in the quiet
// window, not a mid-flight raster.
//
// Held: images that are not yet painted at arm (a complete, sized image is
// already part of the frozen slide texture — hiding it would flicker), plus any
// <img> inserted mid-flight (a MutationObserver catches a data commit's own
// images). The consumer's OWN inline `visibility` is preserved and restored
// exactly. Bounded by the flight span the caller passes, so nothing is held
// past one flight.

const HOLD_ATTR = "data-flemo-img-hold";

// A painted image (decoded, laid out) is part of the texture the slide carries;
// only an image still loading would paint — and re-raster — mid-flight.
const isUnpainted = (img: HTMLImageElement): boolean => !(img.complete && img.naturalWidth > 0);

// A COMPLETE image whose source is far larger than its display box (a members
// list drawing 44px avatars from multi-megapixel press originals) still costs a
// full re-composite of that giant texture every time it remounts — the RE-ENTRY
// case a plain unpainted-only hold misses, because the second visit's images
// are already cached-complete. Holding these too moves that re-composite off
// the flight (revealed at rest). Bounded to genuinely oversized sources so an
// already-sized cached image is never hidden (which would flicker for no gain).
const OVERSIZE_AREA_RATIO = 4;
const isOversizedComplete = (img: HTMLImageElement): boolean => {
  if (!(img.complete && img.naturalWidth > 0)) return false;
  const rect = img.getBoundingClientRect();
  const dpr = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const boxArea = Math.max(1, rect.width * dpr) * Math.max(1, rect.height * dpr);
  return img.naturalWidth * img.naturalHeight > boxArea * OVERSIZE_AREA_RATIO;
};

const shouldHold = (img: HTMLImageElement): boolean => isUnpainted(img) || isOversizedComplete(img);

export function beginImageRevealHold(scope: Element | null, backstopMs: number): () => void {
  if (
    !scope ||
    typeof document === "undefined" ||
    typeof MutationObserver !== "function" ||
    typeof setTimeout !== "function"
  ) {
    return () => {};
  }

  // Each held image's ORIGINAL inline display (""/absent restores by removal),
  // so a consumer's own `display` survives the hold untouched. `display: none`
  // (not `visibility: hidden`): a hidden-but-displayed image is still LAID OUT,
  // DECODED, and its texture UPLOADED — for a multi-megapixel source that giant
  // upload is the very re-entry cost we are removing, so it must leave the
  // render tree entirely and re-enter (cheap off-main on Blink) at rest. The
  // consumer's box keeps its size (the avatar wrapper is explicitly sized), so
  // no layout shift.
  const originals = new Map<HTMLImageElement, string>();

  const hold = (img: HTMLImageElement) => {
    if (originals.has(img) || !shouldHold(img)) return;
    originals.set(img, img.style.display);
    img.style.display = "none";
    img.setAttribute(HOLD_ATTR, ""); // inspectable marker; the Map owns the value
  };

  for (const img of scope.querySelectorAll("img")) hold(img as HTMLImageElement);

  // A data commit adds its own <img>s mid-flight; hold those too.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLImageElement) hold(node);
        else if (node instanceof Element) {
          for (const img of node.querySelectorAll("img")) hold(img as HTMLImageElement);
        }
      }
    }
  });
  observer.observe(scope, { childList: true, subtree: true });

  let released = false;
  const reveal = () => {
    if (released) return;
    released = true;
    observer.disconnect();
    for (const [img, display] of originals) {
      if (display) img.style.display = display;
      else img.style.removeProperty("display");
      img.removeAttribute(HOLD_ATTR);
    }
    originals.clear();
  };

  const backstop = setTimeout(reveal, Math.max(0, backstopMs));
  return () => {
    clearTimeout(backstop);
    reveal();
  };
}

export default beginImageRevealHold;
