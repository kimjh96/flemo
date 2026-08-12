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
// - Fresh insert that is ALREADY COMPLETE (memory/HTTP cache — a screen the
//   user re-enters remounts with every avatar instantly loaded) is still
//   PRE-PAINT: mutation records deliver before the commit's rendering
//   update. Its dimensions are readable, so the oversize decision runs
//   locally — well-sized reveals untouched with zero added work; oversized
//   swaps (known verdict) or holds through the probe like any fresh insert.
//   Treating "complete" as "painted" here was the re-entry hole: the whole
//   cached list painted full-resolution originals inside the entering
//   commit, and WebKit's synchronous paint-time decode turned that into a
//   tap-to-flight stall on device.
// - An element that has ALREADY painted (present before this offloader
//   started, authored src changes on a live element) is NEVER touched:
//   re-pointing or hiding a visible image is a blink (measured on device).
//   Its source is probed for future mounts only.
// - An OPAQUE source (non-CORS — the worker cannot even learn its size, so
//   it can never be scaled) must eventually paint as authored, and that
//   paint carries the full synchronous decode. When a navigation is
//   mid-flight, a fresh opaque insert stays hidden until the flight's rest
//   (the flight-window latch) so the decode lands where every other held
//   reveal lands — off the motion. At rest it reveals immediately.
// Well-sized, data:/blob: sources and engines without the needed APIs are
// left exactly as authored.

import { flightWindowActive, onFlightWindowIdle } from "@core/engine/flightWindow";

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

// An opaque reveal deferred to the flight's rest still needs a bound in case
// the flight-window release path dies with its Router: past any plausible
// choreography, reveal anyway.
const OPAQUE_REVEAL_CAP_MS = 3000;

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

// A screen mid-transition carries a transitional status from its very first
// render — readable at insertion time, BEFORE the engine's drive effect has
// opened the flight window.
const TRANSITIONAL_STATUSES = new Set(["PUSHING", "POPPING", "REPLACING"]);
const insideTransitionalScreen = (image: HTMLImageElement): boolean => {
  const screen = image.closest("[data-flemo-screen]");
  return !!screen && TRANSITIONAL_STATUSES.has(screen.getAttribute("data-flemo-status") ?? "");
};

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
  // Per original URL: an object URL to swap to, "skip" (measured well-sized),
  // or "opaque" (unfetchable — size unknowable, can never be scaled).
  const verdicts = new Map<string, string>();
  // A verdict the element's src can be re-pointed to; "skip"/"opaque" reveal
  // the authored source instead.
  const isSwapVerdict = (verdict: string | null | undefined): verdict is string =>
    !!verdict && verdict !== "skip" && verdict !== "opaque";
  // Reveals deferred to the flight's rest (opaque originals inserted
  // mid-flight); disposal must run them so nothing stays hidden.
  const pendingReveals = new Set<() => void>();
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
      if (error) {
        // Unfetchable (usually non-CORS): the size is unknowable and the
        // source can never be scaled — opaque, not merely well-sized.
        settle(url, "opaque");
        return;
      }
      if (skip || !blob) {
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

  // Restore an element's visibility — immediately, except an OPAQUE original
  // while a navigation is mid-flight: its first paint carries the full
  // synchronous decode (WebKit), so the reveal defers to the flight's rest
  // window, bounded in case the window's release path dies with its Router.
  const restoreVisibility = (
    image: HTMLImageElement,
    previousVisibility: string,
    verdict: string | null
  ) => {
    const restore = () => {
      if (previousVisibility) image.style.visibility = previousVisibility;
      else image.style.removeProperty("visibility");
    };
    if (verdict !== "opaque" || !flightWindowActive()) {
      restore();
      return;
    }
    let done = false;
    const reveal = () => {
      /* v8 ignore next -- both triggers (idle + cap) can fire; second is a no-op. */
      if (done) return;
      done = true;
      clearTimeout(cap);
      pendingReveals.delete(reveal);
      restore();
    };
    const cap = setTimeout(reveal, OPAQUE_REVEAL_CAP_MS);
    pendingReveals.add(reveal);
    onFlightWindowIdle(reveal);
  };

  // Schedule `atRest` for the current flight's rest. The entering commit's
  // insertions run BEFORE the drive effect opens the flight window — and the
  // effect can flush later than the first frame on a loaded main thread — so
  // while the screen still reads transitional and no window is open yet,
  // keep polling one frame at a time: whichever comes first — the window
  // opening (park on its release) or the screen leaving its transitional
  // status (flight over) — settles the reveal. The caller's cap bounds a
  // window that never materializes.
  const deferToFlightRest = (image: HTMLImageElement, atRest: () => void) => {
    const tick = () => {
      if (flightWindowActive()) {
        onFlightWindowIdle(atRest);
        return;
      }
      if (!insideTransitionalScreen(image) || typeof requestAnimationFrame !== "function") {
        atRest();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  };

  // Hide `image` through the current flight and run `finish` at its rest
  // (bounded in case the window's release path dies with its Router).
  // Visibility is the ONLY React-safe lever mid-flight: frameworks own src
  // as a prop and echo the authored URL over any swap, but they never
  // manage a visibility they didn't render.
  const holdHiddenUntilRest = (image: HTMLImageElement, finish: () => void): void => {
    const previousVisibility = image.style.visibility;
    image.style.visibility = "hidden";
    let done = false;
    const reveal = () => {
      /* v8 ignore next -- both triggers (rest + cap) can fire; second is a no-op. */
      if (done) return;
      done = true;
      clearTimeout(cap);
      pendingReveals.delete(reveal);
      finish();
      if (previousVisibility) image.style.visibility = previousVisibility;
      else image.style.removeProperty("visibility");
    };
    const cap = setTimeout(reveal, OPAQUE_REVEAL_CAP_MS);
    pendingReveals.add(reveal);
    deferToFlightRest(image, reveal);
  };

  // Keep a known-opaque original unpainted through the current flight: its
  // first paint carries the full synchronous decode (WebKit), so mid-flight
  // it stays hidden until the flight's rest. Returns false at rest (nothing
  // to protect).
  const holdOpaqueUntilRest = (image: HTMLImageElement, url: string): boolean => {
    if (!flightWindowActive() && !insideTransitionalScreen(image)) return false;
    // The ownership stamp doubles as the arrival hold's exemption marker —
    // without it the hold would freeze-revert this very hide (see
    // arrivalHold.exemptFromFreeze). The src stays authored.
    image.setAttribute(OFFLOADED_SRC_ATTR, url);
    holdHiddenUntilRest(image, () => {});
    return true;
  };

  // Swap a known-oversized fresh insert while a flight is in (or entering)
  // progress: the swap itself is applied now (pre-paint), but a framework
  // echo of the authored URL can undo it inside the pre-hold window — and
  // re-asserting mid-flight would ping-pong with the arrival hold's
  // attribute freeze. So the element rides the flight hidden, and the rest
  // repairs the src once (frameworks are quiet by then; their next diff
  // sees authored==authored and stays silent).
  const holdSwapUntilRest = (image: HTMLImageElement, url: string, verdict: string): void => {
    image.setAttribute(OFFLOADED_SRC_ATTR, url);
    image.src = verdict;
    holdHiddenUntilRest(image, () => {
      /* v8 ignore next -- disposal runs pending reveals; nothing to repair. */
      if (disposed) return;
      const settled = verdicts.get(url);
      if (
        isSwapVerdict(settled) &&
        image.getAttribute(OFFLOADED_SRC_ATTR) === url &&
        image.getAttribute("src") !== settled
      ) {
        image.src = settled;
      }
    });
  };

  const release = (image: HTMLImageElement, verdict: string | null) => {
    const info = held.get(image);
    /* v8 ignore next -- release tears down its own triggers (listeners,
       timeout), so a second call has no live path; kept as a guard. */
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
      if (isSwapVerdict(verdict)) {
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
        if (isSwapVerdict(verdict)) {
          image.src = verdict; // OFFLOADED_SRC_ATTR keeps the authored source
        } else {
          image.removeAttribute(OFFLOADED_SRC_ATTR);
          image.src = info.url;
        }
      }
    }
    restoreVisibility(image, info.previousVisibility, verdict);
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
  const considerResponsive = (image: HTMLImageElement, freshInsert: boolean) => {
    // Complete on a fresh insert = cache-preloaded but PRE-PAINT (mutation
    // records deliver before the commit's rendering update): the chosen
    // candidate and its dimensions are already on the element, so the load
    // decision can run synchronously. Complete on the initial sweep =
    // already painted, untouchable.
    const preloaded = image.complete && image.naturalWidth > 0;
    if (preloaded && !freshInsert) return;

    const info: HeldElement = {
      url: "", // the chosen candidate is only known at load
      previousVisibility: image.style.visibility,
      timeout: setTimeout(() => release(image, null), PROBE_REVEAL_TIMEOUT_MS),
      responsive: true
    };
    const onLoad = () => {
      /* v8 ignore next -- consider() only routes elements with an https src
         here, so the final fallback arm is unreachable. */
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
        /* v8 ignore start -- a verdict can only appear via settle(), which
           releases every held element of the url first, so a still-held
           element cannot observe an existing verdict here; kept as a guard
           against future settle() reorderings. */
        if (verdicts.has(url)) {
          release(image, verdicts.get(url)!);
          return;
        }
        /* v8 ignore stop */
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.add(objectUrl);
          settle(url, objectUrl);
          return;
        }
        probe(url, box.width || MIN_TARGET_PX, box.height || MIN_TARGET_PX);
      });
    };
    if (preloaded) {
      held.set(image, info);
      image.style.visibility = "hidden";
      onLoad();
      return;
    }
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

  const consider = (image: HTMLImageElement, freshInsert: boolean) => {
    /* v8 ignore next -- `disposed` guard: disposal disconnects the observer
       in the same tick, so no delivery can race it; kept for direct calls. */
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
      considerResponsive(image, freshInsert);
      return;
    }
    seen.add(image);

    if (image.complete && image.naturalWidth > 0) {
      // An element that has ALREADY painted (present before this offloader —
      // the initial sweep) is untouchable: re-pointing or hiding a visible
      // image is a blink (measured on device as intermittent avatar
      // flicker). Probe its source for FUTURE mounts only.
      if (!freshInsert) {
        const box = image.getBoundingClientRect();
        probe(url, box.width || MIN_TARGET_PX, box.height || MIN_TARGET_PX);
        return;
      }
      // A FRESH insert that is already complete is the cache-warm remount (a
      // re-entered screen): still pre-paint, and its dimensions are readable
      // — decide locally instead of mistaking "complete" for "painted"
      // (that misread let a re-entered list paint every raw original inside
      // the entering commit; WebKit's synchronous paint-time decode made it
      // a tap-to-flight stall).
      const box = image.getBoundingClientRect();
      const oversized = shouldOffloadImage({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        boxWidth: box.width || MIN_TARGET_PX,
        boxHeight: box.height || MIN_TARGET_PX,
        devicePixelRatio: dpr()
      });
      if (!oversized) return;
      const knownVerdict = verdicts.get(url);
      if (isSwapVerdict(knownVerdict)) {
        // Known-oversized with a scaled result: swap before any paint —
        // riding out a flight hidden so a framework echo cannot resurface
        // the original mid-motion.
        if (flightWindowActive() || insideTransitionalScreen(image)) {
          holdSwapUntilRest(image, url, knownVerdict);
        } else {
          image.setAttribute(OFFLOADED_SRC_ATTR, url);
          image.src = knownVerdict;
        }
        return;
      }
      if (knownVerdict === "opaque") {
        // Known-unscalable original about to paint at full resolution: at
        // rest that is simply the cost; mid-flight, the decode relocates to
        // the flight's rest.
        holdOpaqueUntilRest(image, url);
        return;
      }
      if (knownVerdict === "skip") return;
      // No verdict yet: fall through to the standard pre-paint hold + probe
      // (parking discards the cached bitmap; the release re-points from
      // cache, still ahead of any paint).
    }

    const verdict = verdicts.get(url);
    if (verdict === "skip") return;
    if (verdict === "opaque") {
      // A known-unscalable original still loading: from the HTTP cache it
      // completes within the entering commit's first frames and paints its
      // full-resolution decode mid-flight. Same relocation as the complete
      // case — hidden shows nothing an unloaded img wouldn't, and a slow
      // network load simply finds the element revealed at rest.
      holdOpaqueUntilRest(image, url);
      return;
    }
    if (verdict) {
      // Known-oversized source: swap before any paint or download — through
      // a flight, hidden (see holdSwapUntilRest).
      if (flightWindowActive() || insideTransitionalScreen(image)) {
        holdSwapUntilRest(image, url, verdict);
      } else {
        image.setAttribute(OFFLOADED_SRC_ATTR, url);
        image.src = verdict;
      }
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

  const sweep = (node: ParentNode, freshInsert: boolean) => {
    if (node instanceof HTMLImageElement) consider(node, freshInsert);
    /* v8 ignore next -- defensive: every DOM Element implements it. */
    if (typeof (node as Element).querySelectorAll !== "function") return;
    for (const image of Array.from((node as Element).querySelectorAll("img"))) {
      consider(image, freshInsert);
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const added of Array.from(record.addedNodes)) {
        // Observer-delivered nodes are PRE-PAINT (records arrive before the
        // commit's rendering update), whatever their load state; only the
        // initial sweep can meet already-painted elements.
        if (added instanceof Element) sweep(added, true);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  sweep(root, false);

  // React owns `src` as a prop: any re-render after our swap diffs its
  // virtual value (the authored URL) against the DOM (our object URL) and
  // writes the original back — mount-adjacent re-renders undid every swap
  // within a frame on a re-entered screen, so the raw originals loaded and
  // paint-decoded inside the entering commit's window. The war is finite:
  // React never reads the DOM back, so ONE re-assertion per React write is
  // stable (the next diff sees authored==authored and stays silent). A src
  // write to a DIFFERENT url is a genuine consumer change and releases
  // ownership instead. Responsive elements are out of scope (their swap
  // strips candidate markup; a consumer re-render rebuilding srcset is a
  // legitimate takeover).
  const reassert = (image: HTMLImageElement) => {
    const current = image.getAttribute("src") ?? "";
    const info = held.get(image);
    if (info && !info.responsive) {
      // Held (hidden + parked): React's echo of the authored URL would
      // start the original's download mid-hold — re-park it.
      if (current === info.url) image.src = PARKED_PIXEL;
      return;
    }
    const authored = image.getAttribute(OFFLOADED_SRC_ATTR);
    if (!authored) return;
    if (current === authored) {
      const verdict = verdicts.get(authored);
      if (isSwapVerdict(verdict)) image.src = verdict;
    } else if (current !== PARKED_PIXEL && !current.startsWith("blob:")) {
      // A consumer pointed the element somewhere new: ours no longer.
      image.removeAttribute(OFFLOADED_SRC_ATTR);
    }
  };
  // Mid-flight the engine's arrival hold freezes in-place attribute writes
  // (reverting them pre-paint and replaying at rest) — re-asserting there
  // would ping-pong the two observers in an unbounded microtask loop. While
  // a flight window is open, park ONE rest sweep instead: the hold's replay
  // lands React's echoes at rest, and the sweep re-asserts every owned
  // element once after them.
  let restSweepParked = false;
  const srcObserver = new MutationObserver((records) => {
    /* v8 ignore next -- disposal disconnects in the same tick. */
    if (disposed) return;
    if (flightWindowActive()) {
      if (restSweepParked) return;
      restSweepParked = true;
      onFlightWindowIdle(() => {
        restSweepParked = false;
        /* v8 ignore next -- disposal guard for a sweep landing after teardown. */
        if (disposed) return;
        for (const image of Array.from(
          root.querySelectorAll<HTMLImageElement>(`img[${OFFLOADED_SRC_ATTR}]`)
        )) {
          reassert(image);
        }
        for (const image of [...held.keys()]) reassert(image);
      });
      return;
    }
    for (const record of records) {
      if (record.attributeName !== "src") continue;
      reassert(record.target as HTMLImageElement);
    }
  });
  srcObserver.observe(root, { subtree: true, attributes: true, attributeFilter: ["src"] });

  return () => {
    disposed = true;
    observer.disconnect();
    srcObserver.disconnect();
    worker?.terminate();
    worker = null;
    for (const image of [...held.keys()]) release(image, null);
    for (const reveal of [...pendingReveals]) reveal();
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
  /* v8 ignore next 2 -- SSR guard: the test environment always has a body. */
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
