import type { NavigateStatus } from "@navigate/store";

// Anchoring a transition's START to the screen's first painted frame,
// framework-neutral. iOS WebKit anchors a CSS animation's timeline when the
// style change commits; when the entering screen's first frame is expensive
// (layout + raster of a heavy subtree on a mobile GPU), the timeline keeps
// running while nothing new is presented and the opening of the transition is
// never displayed — it reads as abbreviated. The compiled sheet's hold rule
// (`[data-flemo-anim-hold="true"]`) pins `animation-play-state: paused`; a
// binding renders the attribute ON in the same tick its status attribute
// changes, then releases it via `scheduleAnimHoldRelease` so the full duration
// plays against already-painted layers.

export interface AnimHoldInput {
  status: NavigateStatus;
  // This screen is the current top (active) or the one directly beneath it —
  // the only two that take part in a transition.
  isTopOrTopPrev: boolean;
  transitionName: string;
}

// Identity of the transition segment a screen must hold for, or null when the
// screen is at rest / not participating. A binding keys its hold state on this:
// a NEW key (fresh push/pop/replace) re-arms the hold; null clears it.
export function animHoldKey(input: AnimHoldInput): string | null {
  const transitioning =
    input.status === "PUSHING" || input.status === "POPPING" || input.status === "REPLACING";
  if (!transitioning || !input.isTopOrTopPrev) return null;
  return `${input.status}:${input.transitionName}`;
}

export const ANIM_HOLD_RELEASE_BACKSTOP_MS = 300;

// How long the release will wait on image decodes at most. Decoding is
// off-main-thread and usually a few ms; the cap only matters for pathological
// screens and keeps the hold bounded well inside the backstop.
export const ANIM_HOLD_DECODE_CAP_MS = 150;

// How many images the decode wait considers. A transition reveals roughly a
// viewport's worth of content; decoding an unbounded list would waste the cap
// on offscreen rows.
const DECODE_IMAGE_LIMIT = 20;

// The scope's images that are LOADED but possibly discarded-decoded: an
// incomplete image would make decode() wait on the network, which neither the
// hold nor an eager warm-up should ever do.
export function collectDecodableImages(scope: HTMLElement): HTMLImageElement[] {
  return Array.from(scope.querySelectorAll("img"))
    .filter((image) => image.complete && typeof image.decode === "function")
    .slice(0, DECODE_IMAGE_LIMIT);
}

// Fire-and-forget decode warm-up for a screen that just became visible again.
// A browser discards the decoded bitmaps of a frozen (display:none) screen;
// re-decoding a large image then lands on whatever frame first needs it. The
// transition paths hide that inside the anim-hold, but a SWIPE reveals the
// frozen screen under a finger — nothing can hold a gesture — so the best
// possible cover is to start decoding the moment the screen unfreezes.
// Idempotent and near-free when the decoded data is still cached.
export function eagerlyDecodeImages(scope: HTMLElement | null): void {
  if (!scope || typeof scope.querySelectorAll !== "function") return;
  for (const image of collectDecodableImages(scope)) {
    image.decode().catch(() => {});
  }
}

export interface AnimHoldReleaseOptions {
  // Extra vsyncs to hold beyond the standard two-frame anchor. A PARKED screen
  // (pre-rasterizing at its destination under a cover) needs more than one
  // frame for heavy tiles to actually rasterize; two extra frames measured
  // sufficient without a perceptible start delay.
  extraFrames?: number;
  // The screen scope. When provided, the release also waits (bounded) for the
  // scope's loaded images to DECODE: a browser discards the decoded bitmaps of
  // a frozen (display:none) screen, and re-decoding a large image on the first
  // animated frames drops them — the class of jank where a huge asset in a
  // small slot stutters every browser-back. `img.decode()` runs off the main
  // thread, so waiting during the hold converts dropped frames into a few
  // milliseconds of extra stillness before the animation starts.
  scope?: HTMLElement | null;
}

// Schedules the release of a held animation after the screen's first painted
// frame: the first rAF fires before that (heavy) paint, the second after it,
// so releasing on the second frame starts the animation against painted,
// rasterized content — adaptively costing ~2 frames on a fast engine and
// exactly "one heavy frame + one tick" on a slow one. With a `scope`, the
// release additionally waits for the scope's image decodes (see
// AnimHoldReleaseOptions). The timeout is insurance, not a wait: rAF suspends
// in background tabs, and a paused animation left behind would never fire
// `animationend`, hanging the navigation queue. `release` must be idempotent.
// Returns a canceller.
export function scheduleAnimHoldRelease(
  release: () => void,
  options: AnimHoldReleaseOptions = {}
): () => void {
  let cancelled = false;
  let secondFrame = 0;
  const chainedFrames: number[] = [];
  const releaseAfterDecodes = () => {
    const scope = options.scope;
    if (!scope || typeof scope.querySelectorAll !== "function") {
      release();
      return;
    }
    const images = collectDecodableImages(scope);
    if (images.length === 0) {
      release();
      return;
    }
    const decodes = Promise.allSettled(images.map((image) => image.decode()));
    const cap = new Promise<void>((resolve) => {
      setTimeout(resolve, ANIM_HOLD_DECODE_CAP_MS);
    });
    void Promise.race([decodes, cap]).then(() => {
      if (!cancelled) release();
    });
  };
  const chain = (remaining: number) => {
    if (remaining <= 0) {
      releaseAfterDecodes();
      return;
    }
    chainedFrames.push(requestAnimationFrame(() => chain(remaining - 1)));
  };
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => chain(options.extraFrames ?? 0));
  });
  const fallback = setTimeout(release, ANIM_HOLD_RELEASE_BACKSTOP_MS);
  return () => {
    cancelled = true;
    cancelAnimationFrame(firstFrame);
    if (secondFrame) cancelAnimationFrame(secondFrame);
    chainedFrames.forEach((frame) => cancelAnimationFrame(frame));
    clearTimeout(fallback);
  };
}
