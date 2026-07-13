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

// Schedules the READINESS of a held animation after the screen's first painted
// frame, with NO backstop: the first rAF fires before that (heavy) paint, the
// second after it, so `onReady` fires against painted, rasterized content —
// adaptively costing ~2 frames on a fast engine and exactly "one heavy frame +
// one tick" on a slow one. With a `scope`, it additionally waits (bounded by
// ANIM_HOLD_DECODE_CAP_MS) for the scope's image decodes (see
// AnimHoldReleaseOptions). This is the per-screen readiness gate shared by both
// release paths — `scheduleAnimHoldRelease` (a lone screen, its own backstop)
// and `createAnimHoldCoordinator` (a pop's pair, one shared backstop). Backstop
// policy lives with the caller, never here, so the pair barrier can bound the
// whole group with a single timeout. `onReady` must be idempotent. Returns a
// canceller that stops the frame chain and suppresses a late decode.
export function scheduleAnimHoldReadiness(
  onReady: () => void,
  options: AnimHoldReleaseOptions = {}
): () => void {
  let cancelled = false;
  let secondFrame = 0;
  const chainedFrames: number[] = [];
  const readyAfterDecodes = () => {
    const scope = options.scope;
    if (!scope || typeof scope.querySelectorAll !== "function") {
      onReady();
      return;
    }
    const images = collectDecodableImages(scope);
    if (images.length === 0) {
      onReady();
      return;
    }
    const decodes = Promise.allSettled(images.map((image) => image.decode()));
    const cap = new Promise<void>((resolve) => {
      setTimeout(resolve, ANIM_HOLD_DECODE_CAP_MS);
    });
    void Promise.race([decodes, cap]).then(() => {
      if (!cancelled) onReady();
    });
  };
  const chain = (remaining: number) => {
    if (remaining <= 0) {
      readyAfterDecodes();
      return;
    }
    chainedFrames.push(requestAnimationFrame(() => chain(remaining - 1)));
  };
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => chain(options.extraFrames ?? 0));
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(firstFrame);
    if (secondFrame) cancelAnimationFrame(secondFrame);
    chainedFrames.forEach((frame) => cancelAnimationFrame(frame));
  };
}

// Schedules the release of a held animation for a LONE screen (push / replace,
// or a pop with no participating partner): the screen's own readiness (above)
// releases it, and the 300ms backstop is insurance, not a wait — rAF suspends
// in background tabs, and a paused animation left behind would never fire
// `animationend`, hanging the navigation queue. `release` must be idempotent.
// Returns a canceller. Its signature, semantics, and timing are unchanged from
// before the readiness extraction; the pair coordinator layers on top of the
// same readiness gate without altering this path.
export function scheduleAnimHoldRelease(
  release: () => void,
  options: AnimHoldReleaseOptions = {}
): () => void {
  const cancelReadiness = scheduleAnimHoldReadiness(release, options);
  const fallback = setTimeout(release, ANIM_HOLD_RELEASE_BACKSTOP_MS);
  return () => {
    cancelReadiness();
    clearTimeout(fallback);
  };
}

export interface AnimHoldCoordinator {
  // Join the release group for `key` (an `animHoldKey` value). `release` must be
  // idempotent. Returns a canceller for the caller's teardown (React effect
  // cleanup / unmount / interrupt).
  join(key: string, release: () => void, options?: AnimHoldReleaseOptions): () => void;
}

interface AnimHoldGroupMember {
  release: () => void;
  ready: boolean;
  cancelReadiness: () => void;
}

interface AnimHoldGroup {
  members: Set<AnimHoldGroupMember>;
  backstop: ReturnType<typeof setTimeout>;
}

// Only pop is pair-gated; its hold keys are `POPPING:${transitionName}` (see
// animHoldKey). Push/replace hide the same per-screen readiness lag behind the
// entering cover, so they are never grouped.
const PAIRED_STATUS_PREFIX = "POPPING";

// A transition-scoped barrier that releases the anim-hold of every screen in
// ONE pop together.
//
// WHY: the per-screen readiness gate above is correct for a screen in
// isolation, but a POP moves TWO screens as a visual pair — the exiting top and
// the screen revealed beneath it. Their readiness is asymmetric: the exiting
// top usually has no undecoded images and releases in ~2 frames, while the
// revealed screen (an image-heavy list whose decoded bitmaps were discarded
// while it was frozen) waits out its decode. Releasing each at its OWN
// readiness lets the exiting top start ~100ms before the revealed screen, so
// Cupertino's paired slide visibly desyncs (measured on device: the top slides
// while the screen below sits parked at its offset pose, then jumps into a late
// ease). This barrier holds the whole pair until max(readiness) — bounded by
// the SAME 300ms backstop a lone screen gets — so the pair always starts on one
// clock. The per-screen gates themselves are unchanged, and push/replace timing
// stays byte-identical (they delegate straight to scheduleAnimHoldRelease).
//
// One instance per Router scope (the binding wires that): nested Routers, and
// two scopes popping at once, never share a group. No window/document access at
// module scope, so this is SSR-safe like the rest of the file.
export function createAnimHoldCoordinator(): AnimHoldCoordinator {
  const groups = new Map<string, AnimHoldGroup>();

  // Release EVERY member in one synchronous batch, then dissolve the group:
  // clear its shared backstop, drop it from the registry, cancel any still-
  // pending readiness, and empty the member set so a late canceller is a safe
  // no-op. Only ever runs on the group currently registered under `key`:
  // `join` reuses a still-registered group instead of creating a rival, and
  // releaseGroup cancels every member's readiness, so no readiness of a dead
  // group can fire into the registry afterwards.
  const releaseGroup = (key: string, group: AnimHoldGroup) => {
    clearTimeout(group.backstop);
    groups.delete(key);
    const members = [...group.members];
    group.members.clear();
    for (const member of members) {
      member.cancelReadiness();
      member.release();
    }
  };

  const allReady = (group: AnimHoldGroup) => [...group.members].every((member) => member.ready);

  const join: AnimHoldCoordinator["join"] = (key, release, options) => {
    // Non-pop transitions keep their exact former timing: each screen releases
    // at its own readiness with its own backstop.
    if (!key.startsWith(PAIRED_STATUS_PREFIX)) {
      return scheduleAnimHoldRelease(release, options);
    }

    let group = groups.get(key);
    if (!group) {
      // ONE backstop for the whole group: if any member's decode never settles,
      // the pair still releases together at the bound (the lone-screen insurance
      // applied group-wide).
      const created: AnimHoldGroup = {
        members: new Set(),
        backstop: setTimeout(() => releaseGroup(key, created), ANIM_HOLD_RELEASE_BACKSTOP_MS)
      };
      groups.set(key, created);
      group = created;
    }
    const currentGroup = group;

    // The readiness callback closes over `member` from its own initializer —
    // safe because readiness always fires at least one frame later, never
    // synchronously during construction.
    const member: AnimHoldGroupMember = {
      release,
      ready: false,
      cancelReadiness: scheduleAnimHoldReadiness(() => {
        member.ready = true;
        // Release the instant every CURRENT member is ready. Both screens of a
        // pop join within the transition's first effect flushes — well inside
        // the two-frame paint anchor — so by the time the first readiness lands
        // the group holds both. If a binding ever joined one screen so late
        // that the other already released alone, each degrades to today's
        // independent release; the barrier can only remove desync, never add a
        // stall.
        if (allReady(currentGroup)) releaseGroup(key, currentGroup);
      }, options)
    };
    currentGroup.members.add(member);

    return () => {
      // No-op once the group has released (its member set was emptied) or this
      // member already left.
      if (!currentGroup.members.has(member)) return;
      member.cancelReadiness();
      currentGroup.members.delete(member);
      if (currentGroup.members.size === 0) {
        // Last member gone: dissolve the group so no stray backstop survives.
        clearTimeout(currentGroup.backstop);
        groups.delete(key);
        return;
      }
      // Never strand a ready remainder waiting on a departed member.
      if (allReady(currentGroup)) releaseGroup(key, currentGroup);
    };
  };

  return { join };
}
