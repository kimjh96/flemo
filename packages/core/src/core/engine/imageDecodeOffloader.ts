// Off-main decode-to-scale for oversized images — Blink's image pipeline,
// reproduced at the page level for engines that don't have one.
//
// WebKit's GPU-process rendering path decodes an image SYNCHRONOUSLY on the
// main thread, at FULL source resolution, every time its bitmap needs
// re-materializing — ignoring `decoding="async"` (profiled:
// RenderImage::paint → ShareableBitmap::createFromImagePixels → AppleJPEG
// full decode). A production members list painted 44px avatars from raw
// press originals (up to 4971×7456 — 37 megapixels, a ~148MB decoded
// bitmap, 16.7MB on the wire), and the engine's periodic bitmap purge
// turned that into a RECURRING ~380ms main-thread stall that froze taps.
// Ten in-page mitigations failed; the decode is unreachable from script.
//
// The one door the platform leaves open: when a source is CORS-readable,
// fetch its bytes in a WORKER, read the dimensions THERE (waiting for the
// element's own load would mean the original had already painted), and
// downscale oversized sources to display size.
//
// The element lifecycle has exactly ONE intervention point — INSERTION,
// before the element has ever painted:
// - Fresh insert, verdict unknown → the element is HELD (hidden, its own
//   request parked on a transparent pixel so the original isn't downloaded
//   twice) while the worker probes. It then shows the scaled result — or
//   the authored original on a skip — as its FIRST appearance. Even the
//   first-ever encounter never paints the full-resolution original.
// - Fresh insert, verdict known (this session or the Cache API from a prior
//   one) → swapped synchronously before any paint or download.
// - An element that has ALREADY painted (offloader started late, authored
//   src changes on a live element) is NEVER touched: re-pointing or hiding
//   a visible image is a blink (measured on device). Its source is probed
//   for future mounts only.
// Well-sized, non-CORS, data:/blob: sources and engines without the needed
// APIs are left exactly as authored.

// An image is "oversized" when it carries more than this many times the
// pixels its layout box (at device resolution) can show. 8× area is far
// beyond any retina/quality headroom an author could intend.
export const OVERSIZE_AREA_RATIO = 8;

// The downscale keeps 2× the box's device pixels per axis (headroom for
// moderate box growth; visually lossless), and never targets below 96px.
const TARGET_SCALE_HEADROOM = 2;
const MIN_TARGET_PX = 96;

// The hold's safety timeout exists ONLY for a truly wedged worker. It must
// comfortably exceed a slow origin's fetch (a government image server was
// measured at 5s for one original; a 4s timeout revealed the original
// mid-probe — repainting the stall AND flickering when the verdict landed).
const PROBE_REVEAL_TIMEOUT_MS = 15000;

// While held, the element's own request is parked on a transparent pixel so
// the worker's fetch is the single download of the original.
const PARKED_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// The authored source is preserved here for the whole time this module owns
// the element's src, so nothing authored is ever lost.
export const OFFLOADED_SRC_ATTR = "data-flemo-image-src";

// Scaled results persist in the Cache API so a reloaded session also swaps
// at insertion instead of re-paying the original once per load.
const SCALED_CACHE_NAME = "flemo-image-scale-v1";

export interface OversizeInput {
  naturalWidth: number;
  naturalHeight: number;
  boxWidth: number;
  boxHeight: number;
  devicePixelRatio: number;
}

export const shouldOffloadImage = (input: OversizeInput): boolean => {
  if (input.naturalWidth <= 0 || input.naturalHeight <= 0) return false;
  if (input.boxWidth <= 0 || input.boxHeight <= 0) return false;
  const neededArea =
    input.boxWidth * input.boxHeight * input.devicePixelRatio * input.devicePixelRatio;
  return input.naturalWidth * input.naturalHeight > neededArea * OVERSIZE_AREA_RATIO;
};

// The oversize decision runs IN the worker, from the fetched bytes' own
// dimensions, and answers "skip" for well-sized sources.
const WORKER_SOURCE = `onmessage = async (e) => {
  const { url, targetWidth, neededArea, ratio } = e.data;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("http " + response.status);
    const blob = await response.blob();
    const full = await createImageBitmap(blob);
    if (full.width * full.height <= neededArea * ratio) {
      full.close();
      postMessage({ url, skip: true });
      return;
    }
    const scale = targetWidth / full.width;
    const canvas = new OffscreenCanvas(targetWidth, Math.max(1, Math.round(full.height * scale)));
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(full, 0, 0, canvas.width, canvas.height);
    full.close();
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
    postMessage({ url, blob: out });
  } catch (error) {
    postMessage({ url, error: String(error) });
  }
};`;

const supported = (): boolean =>
  typeof Worker !== "undefined" &&
  typeof OffscreenCanvas !== "undefined" &&
  typeof createImageBitmap === "function" &&
  typeof MutationObserver !== "undefined" &&
  typeof URL !== "undefined" &&
  typeof URL.createObjectURL === "function";

const persistScaled = async (url: string, blob: Blob): Promise<void> => {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(SCALED_CACHE_NAME);
    await cache.put(url, new Response(blob, { headers: { "content-type": blob.type } }));
  } catch {
    // Storage unavailable: the in-memory verdict still covers this session.
  }
};

const readScaled = async (url: string): Promise<Blob | null> => {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(SCALED_CACHE_NAME);
    const hit = await cache.match(url);
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
};

interface HeldElement {
  url: string;
  previousVisibility: string;
  timeout: ReturnType<typeof setTimeout>;
  // Responsive elements (srcset / <picture>) are never src-parked; their
  // release swaps src AND strips the candidate markup so the swap wins.
  responsive?: boolean;
  detachListeners?: () => void;
}

export function createImageDecodeOffloader(root: HTMLElement): () => void {
  if (!supported()) return () => {};

  let worker: Worker | null = null;
  let disposed = false;
  // Per original URL: an object URL to swap to, or "skip".
  const verdicts = new Map<string, string>();
  // URLs with a worker probe in flight.
  const probing = new Set<string>();
  // Elements currently held (hidden + parked) awaiting their URL's verdict.
  const held = new Map<HTMLImageElement, HeldElement>();
  const seen = new WeakSet<HTMLImageElement>();
  const objectUrls = new Set<string>();

  const dpr = () => (typeof devicePixelRatio === "number" ? devicePixelRatio : 1);

  const ensureWorker = (): Worker | null => {
    if (worker) return worker;
    try {
      // A blob worker keeps the module dependency-free; a consumer CSP that
      // forbids blob workers simply leaves images as authored.
      worker = new Worker(URL.createObjectURL(new Blob([WORKER_SOURCE])));
    } catch {
      return null;
    }
    worker.onmessage = (event: MessageEvent) => {
      const { url, blob, error, skip } = event.data as {
        url: string;
        blob?: Blob;
        error?: string;
        skip?: boolean;
      };
      probing.delete(url);
      if (error || skip || !blob) {
        settle(url, "skip");
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.add(objectUrl);
      void persistScaled(url, blob);
      settle(url, objectUrl);
    };
    return worker;
  };

  // Record the verdict and give every held element of this URL its FIRST
  // appearance: the scaled result, or the authored original on a skip.
  const settle = (url: string, verdict: string) => {
    if (!verdicts.has(url)) verdicts.set(url, verdict);
    for (const [image, info] of [...held]) {
      if (info.url !== url) continue;
      release(image, verdicts.get(url)!);
    }
  };

  const release = (image: HTMLImageElement, verdict: string | null) => {
    const info = held.get(image);
    if (!info) return;
    held.delete(image);
    clearTimeout(info.timeout);
    info.detachListeners?.();
    if (info.responsive) {
      // The candidate the browser chose was oversized; pin the scaled result
      // by stripping the candidate markup (srcset/sizes on the img and any
      // <picture> <source> siblings — they outrank src). Responsiveness on a
      // later resize is knowingly given up for this element: the authored
      // candidate set was the pathology. A skip/timeout reveals as authored.
      if (verdict && verdict !== "skip") {
        image.setAttribute(OFFLOADED_SRC_ATTR, info.url);
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
        const picture = image.closest("picture");
        if (picture) {
          for (const source of Array.from(picture.querySelectorAll("source"))) {
            source.removeAttribute("srcset");
          }
        }
        image.src = verdict;
      }
    } else {
      // Only touch the element if our parking is still in place — an authored
      // src write while held wins untouched.
      const parked = image.getAttribute("src") === PARKED_PIXEL;
      if (parked) {
        if (verdict && verdict !== "skip") {
          image.src = verdict; // OFFLOADED_SRC_ATTR keeps the authored source
        } else {
          image.removeAttribute(OFFLOADED_SRC_ATTR);
          image.src = info.url;
        }
      }
    }
    if (info.previousVisibility) image.style.visibility = info.previousVisibility;
    else image.style.removeProperty("visibility");
  };

  const probe = (url: string, boxWidth: number, boxHeight: number) => {
    if (verdicts.has(url) || probing.has(url)) return;
    const activeWorker = ensureWorker();
    if (!activeWorker) return;
    probing.add(url);
    const targetWidth = Math.round(
      Math.max(MIN_TARGET_PX, boxWidth * dpr()) * TARGET_SCALE_HEADROOM
    );
    const neededArea = Math.max(boxWidth * boxHeight, MIN_TARGET_PX * MIN_TARGET_PX) * dpr() ** 2;
    activeWorker.postMessage({ url, targetWidth, neededArea, ratio: OVERSIZE_AREA_RATIO });
  };

  // Responsive path: let the browser pick and download its candidate as
  // authored (single download, selection stays correct — no re-implementation
  // of srcset/sizes/media evaluation), but keep the element HIDDEN until that
  // load. An img presents nothing before its resource anyway, so the hold
  // adds ZERO latency; it only guarantees the oversized case never paints.
  // At load the chosen candidate's REAL dimensions are on the element:
  // well-sized reveals as authored (no worker at all); oversized stays
  // hidden through the scale probe and first-appears as the scaled result
  // (release() strips the candidate markup so the swap wins).
  const considerResponsive = (image: HTMLImageElement) => {
    // Already painted: untouchable, same as the bare-img rule.
    if (image.complete && image.naturalWidth > 0) return;

    const info: HeldElement = {
      url: "", // the chosen candidate is only known at load
      previousVisibility: image.style.visibility,
      timeout: setTimeout(() => release(image, null), PROBE_REVEAL_TIMEOUT_MS),
      responsive: true
    };
    const onLoad = () => {
      const url = image.currentSrc || image.getAttribute("src") || "";
      const box = image.getBoundingClientRect();
      const oversized =
        /^https?:/.test(url) &&
        shouldOffloadImage({
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          boxWidth: box.width || MIN_TARGET_PX,
          boxHeight: box.height || MIN_TARGET_PX,
          devicePixelRatio: dpr()
        });
      if (!oversized) {
        release(image, null);
        return;
      }
      info.url = url;
      const verdict = verdicts.get(url);
      if (verdict) {
        release(image, verdict);
        return;
      }
      void readScaled(url).then((blob) => {
        if (disposed || !held.has(image)) return;
        if (verdicts.has(url)) {
          release(image, verdicts.get(url)!);
          return;
        }
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.add(objectUrl);
          settle(url, objectUrl);
          return;
        }
        probe(url, box.width || MIN_TARGET_PX, box.height || MIN_TARGET_PX);
      });
    };
    const onError = () => release(image, null); // authored error path untouched
    info.detachListeners = () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };
    image.addEventListener("load", onLoad);
    image.addEventListener("error", onError);
    held.set(image, info);
    image.style.visibility = "hidden";
  };

  const consider = (image: HTMLImageElement) => {
    if (disposed || seen.has(image)) return;
    if (image.getAttribute(OFFLOADED_SRC_ATTR) !== null) return;
    const url = image.getAttribute("src") ?? "";
    // Only network sources are refetchable; blob/data results (including our
    // own swaps) stay as authored.
    if (!/^https?:/.test(url)) return;
    // Responsive markup (srcset / <picture>): the browser's candidate
    // selection outranks `src`, so the bare-img park below cannot work here.
    // Usually the author already solved sizing (next/image and its kin serve
    // pre-scaled candidates) — but the candidates themselves can be
    // oversized (a degenerate srcset wrapping one raw original;
    // WordPress-style sets that include the full original as a candidate).
    // Piggyback on the browser instead of re-implementing its selection.
    if (image.getAttribute("srcset") !== null || image.closest("picture") !== null) {
      seen.add(image);
      considerResponsive(image);
      return;
    }
    seen.add(image);

    // An element that has ALREADY painted is untouchable — re-pointing or
    // hiding a visible image is a blink (measured on device as intermittent
    // avatar flicker). Probe its source for FUTURE mounts only.
    if (image.complete && image.naturalWidth > 0) {
      const box = image.getBoundingClientRect();
      probe(url, box.width || MIN_TARGET_PX, box.height || MIN_TARGET_PX);
      return;
    }

    const verdict = verdicts.get(url);
    if (verdict === "skip") return;
    if (verdict) {
      // Known-oversized source: swap before any paint or download.
      image.setAttribute(OFFLOADED_SRC_ATTR, url);
      image.src = verdict;
      return;
    }

    // Verdict unknown: hold (hidden + parked) until the probe settles.
    held.set(image, {
      url,
      previousVisibility: image.style.visibility,
      timeout: setTimeout(() => release(image, null), PROBE_REVEAL_TIMEOUT_MS)
    });
    image.style.visibility = "hidden";
    image.setAttribute(OFFLOADED_SRC_ATTR, url);
    image.src = PARKED_PIXEL;

    // A prior session's scaled result settles the URL without the worker;
    // otherwise probe. The box may have no layout yet at insertion — measure
    // a frame later, still far ahead of any network arrival.
    void readScaled(url).then((blob) => {
      if (disposed || verdicts.has(url)) return;
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.add(objectUrl);
        settle(url, objectUrl);
        return;
      }
      const measure = () => {
        if (disposed) return;
        const box = image.getBoundingClientRect();
        probe(url, box.width || MIN_TARGET_PX, box.height || MIN_TARGET_PX);
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(measure);
      else measure();
    });
  };

  const sweep = (node: ParentNode) => {
    if (node instanceof HTMLImageElement) consider(node);
    if (typeof (node as Element).querySelectorAll !== "function") return;
    for (const image of Array.from((node as Element).querySelectorAll("img"))) consider(image);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const added of Array.from(record.addedNodes)) {
        if (added instanceof Element) sweep(added);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  sweep(root);

  return () => {
    disposed = true;
    observer.disconnect();
    worker?.terminate();
    worker = null;
    for (const image of [...held.keys()]) release(image, null);
    probing.clear();
    verdicts.clear();
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  };
}

// One offloader per document is enough (screens all live under body);
// bindings refcount it so nested Routers share a single observer.
let shared: { dispose: () => void; count: number } | null = null;

export default function ensureImageDecodeOffloader(): () => void {
  if (typeof document === "undefined" || !document.body) return () => {};
  if (shared) {
    shared.count += 1;
  } else {
    shared = { dispose: createImageDecodeOffloader(document.body), count: 1 };
  }
  return () => {
    if (!shared) return;
    shared.count -= 1;
    if (shared.count <= 0) {
      shared.dispose();
      shared = null;
    }
  };
}
