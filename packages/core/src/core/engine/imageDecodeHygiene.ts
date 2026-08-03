// Async-decode stamping for a transitional screen's images.
//
// The one main-thread stall the flight armor (response park, arrival hold,
// invisible-animation hold) cannot reach: SYNCHRONOUS image decode. A screen
// entering a flight paints its already-present <img> content as its tiles
// come onscreen — mid-motion, by definition — and a large source (device-
// measured: a 37-megapixel portrait JPEG served by a public API) decodes on
// the main thread inside that paint. Real-device tracer attribution: a 770ms
// push stretched to 1405ms by two decode stalls (348ms and 277ms, both
// attributed to no React commit — pure decode/raster), the returning screen
// of a pop showing the same intermittent single-frame hitch. The library's
// canvas-rescale offloader cannot touch these images either — no CORS
// headers means a tainted canvas.
//
// `decoding="async"` is the platform's own remedy: the browser MAY present
// frames before the decode completes, moving the decode off the paint's
// critical path (the image pops in a frame or two later instead of freezing
// the motion). This module stamps it on every <img> under a transitional
// screen that the CONSUMER HAS NOT explicitly authored a `decoding`
// attribute on — an authored "sync"/"auto" is a deliberate choice and is
// never overridden. The stamp is left in place after the flight: decode
// happens once, and async decoding is strictly less blocking for any later
// repaint too.
//
// Deliberately NOT a load hold: an earlier attempt that deferred image
// LOADS during flights was device-judged worse (images landed visibly late
// everywhere). Loads start exactly as authored here; only the decode's
// scheduling changes.

export const stampAsyncImageDecode = (scope: HTMLElement) => {
  /* v8 ignore next -- SSR/foreign-scope guard. */
  if (typeof scope.querySelectorAll !== "function") return;
  // The scope itself may BE an image (an arrival-held <img> node).
  if (scope.tagName === "IMG" && !scope.hasAttribute("decoding")) {
    scope.setAttribute("decoding", "async");
  }
  for (const img of Array.from(scope.querySelectorAll("img:not([decoding])"))) {
    img.setAttribute("decoding", "async");
  }
};
