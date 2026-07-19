// Off-main decode-to-scale for oversized images — Blink's image pipeline,
// reproduced at the page level for engines that don't have one.
//
// WebKit's GPU-process rendering path decodes an image SYNCHRONOUSLY on the
// main thread, at FULL source resolution, every time its bitmap needs
// re-materializing — ignoring `decoding="async"` (profiled:
// RenderImage::paint → ShareableBitmap::createFromImagePixels → AppleJPEG
// full decode). A production members list painted 44px avatars from raw
// press originals (up to 4971×7456 — 37 megapixels, a ~148MB decoded
// bitmap, ~2100× the pixels the slot needs), and the engine's periodic
// bitmap purge turned that into a RECURRING ~380ms main-thread stall that
// froze taps landing near it. Ten in-page mitigations failed — the decode
// itself is unreachable from script. Blink never has this problem: it
// decodes on raster workers, scaled to the destination.
//
// This module gives WebKit the same deal, with the one door the platform
// does leave open: when an image's source is CORS-readable, fetch its bytes
// in a WORKER, decode + downscale there (createImageBitmap on a worker
// thread never touches the main thread), and swap the element's source to
// the display-sized result. After the swap the engine's re-decodes cost
// ~1ms instead of ~380ms — measured: recurring stalls 4/4 → 0/4. Images
// that are not oversized, not CORS-readable, or on engines without the
// needed APIs are left exactly as authored.

// An image is "oversized" when it carries more than this many times the
// pixels its layout box (at device resolution) can show. 8× area is far
// beyond any retina/quality headroom an author could intend.
export const OVERSIZE_AREA_RATIO = 8;

// The downscale target keeps 2× the box's device pixels per axis, so later
// moderate box growth still has headroom and the swap is visually lossless.
const TARGET_SCALE_HEADROOM = 2;

// Never downscale below this many CSS px per axis (tiny boxes still get a
// crisp, zoomable-ish bitmap).
const MIN_TARGET_PX = 96;

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

// The original source is preserved here so nothing authored is lost and
// diagnostics can see what was replaced.
export const OFFLOADED_SRC_ATTR = "data-flemo-image-src";

// The oversize decision lives IN the worker: waiting for the element's
// natural dimensions on the main thread would mean waiting for the original
// download — by which time the full-resolution first paint (the stall) has
// already happened. The worker reads the dimensions from the bytes itself
// and answers "skip" for well-sized sources.
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

interface PendingJob {
  targets: Set<HTMLImageElement>;
}

export function createImageDecodeOffloader(root: HTMLElement): () => void {
  if (!supported()) return () => {};

  let worker: Worker | null = null;
  const jobs = new Map<string, PendingJob>();
  const processed = new WeakSet<HTMLImageElement>();
  const objectUrls = new Set<string>();

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
      const job = jobs.get(url);
      jobs.delete(url);
      if (!job || error || skip || !blob) return;
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.add(objectUrl);
      for (const image of job.targets) {
        // The author may have re-pointed the element mid-flight; only swap
        // when it still shows the source we downscaled.
        if (!image.isConnected || image.currentSrc !== url) continue;
        image.setAttribute(OFFLOADED_SRC_ATTR, url);
        image.src = objectUrl;
      }
    };
    return worker;
  };

  const submit = (image: HTMLImageElement, url: string, boxWidth: number, boxHeight: number) => {
    const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
    const targetWidth = Math.round(Math.max(MIN_TARGET_PX, boxWidth * dpr) * TARGET_SCALE_HEADROOM);
    const neededArea = Math.max(boxWidth * boxHeight, MIN_TARGET_PX * MIN_TARGET_PX) * dpr * dpr;
    const activeWorker = ensureWorker();
    if (!activeWorker) return;
    let job = jobs.get(url);
    if (!job) {
      job = { targets: new Set() };
      jobs.set(url, job);
      activeWorker.postMessage({ url, targetWidth, neededArea, ratio: OVERSIZE_AREA_RATIO });
    }
    job.targets.add(image);
  };

  const consider = (image: HTMLImageElement) => {
    if (processed.has(image)) return;
    if (image.getAttribute(OFFLOADED_SRC_ATTR) !== null) return;
    const url = image.currentSrc || image.src;
    // Only network sources are refetchable; blob/data results (including our
    // own swaps) stay as they are.
    if (!/^https?:/.test(url)) return;
    processed.add(image);
    // The layout box may not exist yet at insertion time; measure one frame
    // later — still far ahead of a large original's download, which is the
    // whole point of probing at insertion instead of at load.
    const measureAndSubmit = () => {
      if (!image.isConnected) return;
      const box = image.getBoundingClientRect();
      submit(image, url, box.width || MIN_TARGET_PX, box.height || MIN_TARGET_PX);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(measureAndSubmit);
    else measureAndSubmit();
  };

  const sweep = (node: ParentNode) => {
    if (node instanceof HTMLImageElement) consider(node);
    if (typeof (node as Element).querySelectorAll !== "function") return;
    for (const image of Array.from((node as Element).querySelectorAll("img"))) consider(image);
  };

  // A load-complete image (fresh network arrival or cache hit) is the
  // decision point: only then are its natural dimensions known.
  const onLoad = (event: Event) => {
    if (event.target instanceof HTMLImageElement) consider(event.target);
  };
  root.addEventListener("load", onLoad, true);

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
    root.removeEventListener("load", onLoad, true);
    observer.disconnect();
    worker?.terminate();
    worker = null;
    jobs.clear();
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
