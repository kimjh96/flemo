import type { NavigateStatus } from "@navigate/store";

import { hasPendingRequests } from "@screen/pendingNetwork";

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

// NOTE (shell-first, removed): a `shouldMountShellFirst` predicate lived here
// (defer the entering screen's children to a post-release commit). It was
// shipped and REVERTED: unconditional deferral made every light screen enter as
// a blank shell with late content pop-in (reads as flicker/double-render on
// real apps). Children commit with the screen again; a heavy mount block now
// DELAYS the transition start instead of losing the window, because the task
// gate re-arms until the hold releases (TaskManger.armBackstop + the
// motion-anchored condition in the navigation/step controllers).

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
  // Whether to wait on the scope's image decodes before releasing (default
  // true). The decode wait exists ONLY to cover a browser re-decoding bitmaps
  // it discarded while the screen was FROZEN. A screen that is currently
  // visible (a push/replace exit side, the exiting top) or freshly mounted
  // (any enter side) never had its bitmaps discarded, so there is nothing to
  // re-decode and waiting is pure latency. Set false for those screens. Doing
  // so is also what makes pairing push/replace free: with both members of the
  // pair skipping the wait, the group releases at max(2rAF, 2rAF) — the barrier
  // adds no time over releasing each alone (see createAnimHoldCoordinator).
  decodeWait?: boolean;
  // Wait for the screen's first CONTENT WAVE before starting the motion.
  // Glass measurement (real display recording, region captured): a warm
  // screen's flight is perfectly monotone, while a cold screen's flight holds
  // one frame and then double-steps at the moment its data commits — the
  // tremor, reproducible with every flemo mechanism disabled, so it is the
  // commit itself stealing a compositor tick. Waiting for that commit BEFORE
  // the motion makes a cold flight identical to a warm one, and the
  // destination arrives complete instead of assembling under the eye.
  // Bounded twice: `contentWaitMs` for the first mutation to show up at all,
  // and `contentCapMs` for the whole wait.
  contentSettle?: {
    // How long to wait for a CONTENT wave to show up at all before giving up
    // and starting the motion (a screen with nothing pending must not pay).
    firstWaitMs: number;
    // Hard bound on the whole wait.
    capMs: number;
    // How long to give this screen's mount effects to issue their requests
    // before concluding that nothing is loading.
    graceMs: number;
    // Added nodes that make a batch count as content rather than the shell's
    // own skeleton commits, which land immediately and would otherwise satisfy
    // the gate before any data exists.
    minNodes: number;
    // RENDER-settle mode: wait only for the mount RENDER to quiesce (the
    // commit storm to stop), NOT for in-flight data. The original gate waited
    // for requests to land — a ~300ms-plus floor (React throttles suspense
    // reveals to fallback+300ms) that read as a dead tap. The device-measured
    // jank, though, is the RENDER blocking the opening, not the data (async,
    // deferred to rest anyway). So this mode releases as soon as the render
    // settles: a light screen releases in ~1 frame (no felt delay), a heavy
    // one after its render finishes (adaptive), and neither waits on the wire.
    renderSettleOnly?: boolean;
  };
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
// Text per element below which a screen reads as a skeleton rather than
// content (see the settle gate).
const SHELL_TEXT_PER_ELEMENT = 3;
// An image IS content, and an image-heavy list (photo cards with short
// labels) reads as text-poor: the production members list measured 544
// characters over ~400 elements while fully loaded, which the text rule alone
// would call a skeleton. Skeletons are built from boxes, not <img>, so
// counting each image as content separates them.
const IMAGE_TEXT_EQUIVALENT = 40;
// A shell is a screen WITHOUT content — a skeleton's structure, or almost
// nothing at all. An earlier version additionally required a minimum element
// count (24), reasoning that a near-empty screen is "not a placeholder for
// anything"; that misread every DEFERRED-skeleton consumer pattern (a
// skeleton that renders nothing for its first ~300ms to avoid flashing on
// fast loads — plen's DelayedSkeleton): the cold mount is a handful of empty
// containers, the gate declared it "warm" and released straight into the
// reveal render — device-video'd as the member-detail push departing blank
// and swallowing its opening on the reveal's main-thread block. Content
// density alone is the right test; a genuinely sparse screen with nothing in
// flight still exits at the GRACE (see the graceTimer below), which is what
// actually distinguishes an empty state from a pre-content one.
const looksLikeShell = (scope: HTMLElement): boolean => {
  if (typeof scope.querySelectorAll !== "function") return false;
  const elements = Math.max(1, scope.querySelectorAll("*").length);
  /* v8 ignore start -- textContent is null only for document nodes. */
  const content =
    (scope.textContent ?? "").trim().length +
    scope.querySelectorAll("img").length * IMAGE_TEXT_EQUIVALENT;
  /* v8 ignore stop */
  return content / elements < SHELL_TEXT_PER_ELEMENT;
};

// React throttles the commit that swaps a suspense fallback for its content:
// once a fallback has painted, the reveal is deferred until well after it
// (FALLBACK_THROTTLE_MS, 300ms today — an internal constant that varies by
// React version), even when the data resolved instantly from a cache. During
// that deferral NOTHING is observable from outside — no request in flight, no
// mutation — yet a reveal commit is scheduled and will land. Traced on a
// production app: gate released at +164ms on the "sparse screen" grace,
// React's deferred reveal landed at fallback+300ms, 133ms INTO the flight,
// cancelling ~130 skeleton animations and skipping a vsync mid-slide. The
// gate therefore keys on STATE, never on a timing window: as long as the
// scope still reads as a skeleton whose placeholders animate, the reveal has
// not landed yet and the wait continues (the settle cap is the only bound) —
// robust to whatever deferral a device, an engine, or a React version
// actually produces.
//
// What separates that throttled skeleton from a genuinely sparse screen (an
// empty state, an error page) is that a skeleton ANIMATES — its shimmer/pulse
// placeholders run CSS animations while they wait. flemo's own screen and
// decorator animations all compile under the `flemo-` keyframe prefix, so any
// other running animation inside the scope is the consumer's placeholder.
const hasAnimatedPlaceholders = (scope: HTMLElement): boolean => {
  if (typeof scope.getAnimations !== "function") return false;
  return scope.getAnimations({ subtree: true }).some((animation) => {
    const name = (animation as CSSAnimation).animationName;
    return typeof name !== "string" || !name.startsWith("flemo-");
  });
};

// The pending-request counter sees fetch/XHR but is BLIND to <img> loads —
// traced on production as a commit wave (image paints + a raster burst) 31ms
// into a flight whose reveal had already settled: the markup landed before the
// motion, its images finished DURING it. An incomplete image inside the
// scope's first screenful counts as in-flight work exactly like a pending
// request (same bounds: the settle cap). Deliberately narrow:
// - Only the scope's first screenful, measured against the SCOPE's own box —
//   a held screen sits translated offscreen, so the window viewport is the
//   wrong frame. Below-the-fold images land invisibly.
// - Only DECODE_IMAGE_LIMIT images, the same viewport's-worth bound the
//   decode wait uses.
// - A lazy image that has not even selected a source may never start loading
//   while the screen holds offscreen — waiting on it would burn the whole
//   cap, so it is skipped (it was never going to land mid-flight anyway).
// A failed load also flips `complete`, so a broken image cannot stall this.
const hasPendingImages = (scope: HTMLElement): boolean => {
  /* v8 ignore next -- the settle gate only runs a scope past looksLikeShell,
     which already requires querySelectorAll. */
  if (typeof scope.querySelectorAll !== "function") return false;
  /* v8 ignore next 2 -- every DOM element implements getBoundingClientRect;
     the guard shields exotic embedders. */
  const scopeRect =
    typeof scope.getBoundingClientRect === "function" ? scope.getBoundingClientRect() : null;
  // A zero-height box (jsdom, a display:none edge) cannot frame a screenful —
  // consider every image rather than silently skipping them all.
  const screenful = scopeRect && scopeRect.height > 0 ? scopeRect : null;
  let considered = 0;
  for (const image of Array.from(scope.querySelectorAll("img"))) {
    if (considered >= DECODE_IMAGE_LIMIT) break;
    if (image.loading === "lazy" && !image.currentSrc) continue;
    if (screenful && image.getBoundingClientRect().top - screenful.top >= screenful.height) {
      continue;
    }
    considered += 1;
    if (!image.complete) return true;
  }
  return false;
};

export function scheduleAnimHoldReadiness(
  onReady: () => void,
  options: AnimHoldReleaseOptions = {}
): () => void {
  let cancelled = false;
  let secondFrame = 0;
  const chainedFrames: number[] = [];
  const cancellers: (() => void)[] = [];
  const readyAfterDecodes = () => {
    // The canceller runs every stage's cleanup (including the settle gate's
    // finish, whose normal job is to fire the next stage) — a cancelled
    // readiness must swallow that call, not release the hold.
    if (cancelled) return;
    const scope = options.scope;
    // decodeWait === false: release right after the paint anchor, exactly as if
    // the scope had no images. The wait only pays off for a screen waking from
    // a freeze; a visible or freshly-mounted screen has nothing to re-decode,
    // so skipping it removes pure latency (and keeps a push/replace pair free —
    // see AnimHoldReleaseOptions.decodeWait / createAnimHoldCoordinator).
    if (options.decodeWait === false || !scope || typeof scope.querySelectorAll !== "function") {
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
  // See AnimHoldReleaseOptions.contentSettle. Watches the scope for consumer
  // commits: nothing within `firstWaitMs` means the screen is already complete
  // (a warm destination) and the motion starts immediately; a commit extends
  // the wait until two quiet frames, bounded by `capMs`.
  const settleForContent = (done: () => void) => {
    const settle = options.contentSettle;
    const scope = options.scope;
    if (!settle || !scope || typeof MutationObserver === "undefined") {
      done();
      return;
    }
    // Two independent conditions must BOTH hold for this screen to be worth
    // waiting on, because either alone misreads a common case:
    //
    // - Something is in flight. Nothing pending means nothing is coming.
    // - The screen is still a SHELL. A stale-while-revalidate cache refetches
    //   on mount, so a fully-rendered warm screen has requests in flight too;
    //   what separates them is that a skeleton carries structure without text.
    //   Measured on a production list at the anchor: cold 165 chars over 235
    //   elements (0.7), the same screen warm 1716 over 196 (8.8) — a factor of
    //   twelve, and the threshold sits an order of magnitude from both.
    // Render-settle mode watches for the commit wave to quiesce regardless of
    // shell/warm state (a warm screen simply sees no qualifying commit and
    // gives up at `firstWaitMs` — no felt delay), and never consults the wire.
    const loadingWait = () =>
      !settle.renderSettleOnly && (somethingLoading() || awaitingThrottledReveal());
    // A screen that already carries its content is warm: never wait. (Skipped
    // in render-settle mode, which relies on the commit-quiet path + the
    // firstWaitMs give-up to keep a warm screen delay-free.)
    if (!settle.renderSettleOnly && !looksLikeShell(scope)) {
      done();
      return;
    }
    /* v8 ignore start -- performance exists in every runtime under test;
       the fallback only shields exotic embedders. */
    const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
    const elapsed = () => (typeof performance !== "undefined" ? performance.now() : 0) - startedAt;
    /* v8 ignore stop */
    let quietFrames: number[] = [];
    let seen = false;
    let finished = false;
    // React is holding a throttled suspense reveal for this scope: still a
    // shell, placeholders animating (see hasAnimatedPlaceholders). Pure state,
    // no timing window — the reveal ENDS this condition when it lands, and the
    // settle cap bounds the wait if it never does.
    const awaitingThrottledReveal = () => looksLikeShell(scope) && hasAnimatedPlaceholders(scope);
    // In-flight work this screen is still waiting on: network requests OR the
    // first screenful's images (see hasPendingImages) — either landing
    // mid-flight costs a frame, so both hold the gate under the same cap.
    const somethingLoading = () => hasPendingRequests() || hasPendingImages(scope);
    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(graceTimer);
      clearTimeout(firstTimer);
      clearTimeout(capTimer);
      quietFrames.forEach((frame) => cancelAnimationFrame(frame));
      quietFrames = [];
      done();
    };
    // Real quiescence, not "two frames since the first wave". A screen's data
    // arrives in BEATS — a list, then its sections, then a secondary query —
    // and a gate that releases between beats starts the motion in the middle
    // of the storm, which measures WORSE than not gating at all (deep journey,
    // 24 transitions: 29% velocity noise gated on two frames vs 3% ungated).
    // Waiting for a genuinely calm window is the whole point of the gate.
    const QUIET_FRAMES = 6;
    // A wave that DE-SHELLED the scope with nothing left in flight is not the
    // middle of a storm — it is the reveal itself, the very commit the gate
    // exists to keep out of the motion. Everything after it (paint + raster)
    // needs the standard two-frame anchor, not six: the beat-storm case the
    // long window guards against always has requests pending, which the
    // countdown's exit re-checks anyway. Every quiet frame here is tap-to-
    // motion latency on cold screens, so spend the minimum.
    const QUIET_FRAMES_AFTER_REVEAL = 2;
    const quietSpan = () =>
      // Render-settle waits out the mount STORM (React commits the heavy
      // subtree over several passes, plus any straggler effect commit) — the
      // long window, not the two-frame reveal anchor, or a late commit lands on
      // the release frame (device-measured: the intermittent detail-push "시작
      // 직후 끊김", always-on on the 30Hz Note 9 where the storm runs longer).
      settle.renderSettleOnly
        ? QUIET_FRAMES
        : !looksLikeShell(scope) && !loadingWait()
          ? QUIET_FRAMES_AFTER_REVEAL
          : QUIET_FRAMES;
    // RASTER-settle (renderSettleOnly): the DOM going quiet is not the same as
    // the pixels being READY. On WebKit a heavy screen's first raster is a
    // 200-500ms paint/layout block that is not a DOM mutation and not a JS long
    // task — so a gate that releases on DOM-quiescence alone still hands the
    // slide an unrasterized layer, and the raster lands mid-flight (compiled:
    // the clock runs through the block and the slide jumps; player: it freezes)
    // — device-reproduced as the rapid-LPM detail-push jump. The pre-raster
    // hold (react ScreenMotion: the entering screen is painted at ~0 opacity
    // during park-under) makes WebKit raster the tiles DURING this wait, and a
    // raster in progress shows as a long rAF gap. So a quiet frame must also be
    // a FAST frame: a gap past the block threshold resets the countdown, and
    // the gate only releases once the pixels have gone quiet too. Bounded by
    // capMs; a light screen never blocks, so it never waits.
    const RASTER_BLOCK_GAP_MS = 48;
    // GIVE-UP raster guard (renderSettleOnly). The wave detector above keys on
    // ADDED nodes (minNodes) — correct for a mounting PUSH, but a POP's
    // returning screen re-uses its frozen DOM: the unfreeze commits almost no
    // added nodes, so no wave ever qualifies and the grace/firstWait timers
    // become the release path — releasing on a wall clock while the unfreeze's
    // own style/layout/paint block (not a mutation, not a JS long task) is
    // still due. Device-measured on a fully-loaded infinite list (desktop
    // steady-60 player): EVERY heavy pop opened with one ~50-60ms frame gap
    // overlapping flight start — the exact stutter class this gate exists to
    // absorb. So in render-settle mode a give-up release must ride TWO
    // consecutive FAST frames: a slow frame (the block just ran, or the timer
    // fired right before one) restarts the pair, capMs bounds the wait. A
    // healthy warm screen's frames are all fast — the guard adds ~2 frames
    // there, inside the same budget the readiness gate always cost.
    const GIVEUP_FAST_FRAMES = 2;
    let givingUp = false;
    const finishWhenFramesFast = () => {
      if (!settle.renderSettleOnly) {
        finish();
        return;
      }
      if (givingUp || finished) return;
      givingUp = true;
      // Baseline at the timer, not the first frame: with a null seed the
      // first rAF always reads "fast", so a block that starts right after
      // the give-up timer fires would slip past half the pair.
      let lastTs: number | null = typeof performance !== "undefined" ? performance.now() : null;
      const step = (remaining: number) => {
        if (remaining <= 0 || elapsed() >= settle.capMs) {
          finish();
          return;
        }
        quietFrames.push(
          requestAnimationFrame((ts) => {
            const blocked = lastTs !== null && ts - lastTs > RASTER_BLOCK_GAP_MS;
            lastTs = ts;
            step(blocked ? GIVEUP_FAST_FRAMES : remaining - 1);
          })
        );
      };
      step(GIVEUP_FAST_FRAMES);
    };
    const quiet = () => {
      quietFrames.forEach((frame) => cancelAnimationFrame(frame));
      quietFrames = [];
      let lastFrameTs: number | null = null;
      const step = (remaining: number) => {
        if (remaining <= 0) {
          // Still fetching means another beat is coming; a scope that is
          // STILL an animated shell means the throttled reveal has not landed
          // yet — release now and it lands mid-flight. Keep waiting for
          // either (the cap is the backstop).
          if (loadingWait() && elapsed() < settle.capMs) {
            quietFrames.push(requestAnimationFrame(() => step(quietSpan())));
            return;
          }
          finish();
          return;
        }
        quietFrames.push(
          requestAnimationFrame((ts) => {
            const rasterBlocked =
              settle.renderSettleOnly &&
              lastFrameTs !== null &&
              ts - lastFrameTs > RASTER_BLOCK_GAP_MS &&
              elapsed() < settle.capMs;
            lastFrameTs = ts;
            step(rasterBlocked ? quietSpan() : remaining - 1);
          })
        );
      };
      step(quietSpan());
    };
    const observer = new MutationObserver((records) => {
      let added = 0;
      for (const record of records) {
        /* v8 ignore next -- the observer subscribes to childList only. */
        if (record.type !== "childList") continue;
        for (const node of Array.from(record.addedNodes)) {
          added += node instanceof Element ? 1 + node.querySelectorAll("*").length : 1;
        }
      }
      if (added < settle.minNodes) return;
      seen = true;
      /* v8 ignore start -- the cap timer fires the moment elapsed reaches
         capMs, so a delivery can never observe elapsed past the cap first;
         kept so a delivery racing the timer can only ever finish early. */
      if (elapsed() >= settle.capMs) {
        finish();
        return;
      }
      /* v8 ignore stop */
      quiet();
    });
    observer.observe(scope, { childList: true, subtree: true });
    // A shell with nothing in flight is not loading — it is simply a sparse
    // screen (an empty state, an error). Give up on the short grace instead of
    // the full window. The check is deferred rather than immediate because a
    // screen's own requests are issued by its mount effects, a tick after the
    // paint this gate is anchored to. A shell whose placeholders ANIMATE is
    // the exception: that is a skeleton whose data resolved from a cache and
    // whose reveal commit React is throttling (see hasAnimatedPlaceholders) —
    // nothing is observable yet, but the reveal is coming, so this early exit
    // must not fire; the give-up deadline and the settle cap remain the
    // bounds.
    const graceTimer = setTimeout(() => {
      if (!seen && !loadingWait()) finishWhenFramesFast();
    }, settle.graceMs);
    // Giving up at a fixed deadline is what leaves the slow screens exposed:
    // measured at an emulated mobile viewport, a flight whose content lands
    // inside it is bad in a third of transitions, while a flight that waits is
    // clean in every one. So the deadline only applies while NOTHING is in
    // flight — as long as this screen still has requests outstanding, its
    // content is genuinely coming and the wait continues to the cap.
    const firstTimer = setTimeout(function giveUp() {
      if (seen) return;
      if (loadingWait() && elapsed() < settle.capMs) {
        setTimeout(giveUp, 100);
        return;
      }
      finishWhenFramesFast();
    }, settle.firstWaitMs);
    const capTimer = setTimeout(finish, settle.capMs);
    cancellers.push(finish);
  };
  const chain = (remaining: number) => {
    if (remaining <= 0) {
      settleForContent(readyAfterDecodes);
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
    cancellers.forEach((cancel) => cancel());
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
  // The backstop is insurance against a suspended rAF, not a wait — so it must
  // OUTLAST every bounded wait the readiness gate can legitimately hold.
  // With a content settle configured the gate may wait up to its cap (a
  // throttled suspense reveal, requests still in flight); a 300ms backstop
  // under that cap would fire first and release the motion INTO the very
  // commit the gate is waiting out — measured as the reveal and the flight
  // starting on the same frame.
  const settleCapMs = options.contentSettle?.capMs ?? 0;
  const fallback = setTimeout(release, ANIM_HOLD_RELEASE_BACKSTOP_MS + settleCapMs);
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
  // The bound the current backstop was armed with, so a later-joining member
  // with a LONGER legitimate wait (a content settle) can extend it.
  backstopMs: number;
}

// The backstop a member's options call for: insurance against a suspended rAF,
// never a wait — so it must outlast every bounded wait the readiness gate can
// legitimately hold. With a content settle configured the gate may wait up to
// its cap (a throttled suspense reveal, requests still in flight); a plain
// 300ms backstop under that cap fires first and releases the motion INTO the
// very commit the gate is waiting out — measured on a production push as the
// reveal and the flight starting on the same frame.
const backstopBoundMs = (options?: AnimHoldReleaseOptions) =>
  ANIM_HOLD_RELEASE_BACKSTOP_MS + (options?.contentSettle?.capMs ?? 0);

// A transition-scoped barrier that releases the anim-hold of every screen in
// ONE navigation together — push, replace, AND pop.
//
// WHY: the per-screen readiness gate above is correct for a screen in
// isolation, but a navigation moves TWO screens as a visual pair — the exiting
// screen and the entering one. Their readiness is asymmetric: a screen waking
// from a freeze (a pop destination, image-heavy, whose decoded bitmaps were
// discarded while frozen) waits out its decode, while its visible partner is
// ready in ~2 frames. Releasing each at its OWN readiness lets the fast one
// start ~100ms before the slow one, so a paired slide visibly desyncs (measured
// on device: one screen slides while the other sits parked at its offset pose,
// then jumps into a late ease). This barrier holds the whole pair until
// max(readiness) — bounded by the SAME 300ms backstop a lone screen gets — so
// the pair always starts on one clock. The per-screen gates are unchanged.
//
// Every status groups. An earlier policy pair-gated only POP, on the theory
// that a push/replace entering screen COVERS the exiting one and so hides its
// release lag. That masking assumption is false for non-covering transitions
// (a fade, or a small-shift crossfade, shows both layers at once): there the
// exiting screen's decode-gated late release destroys the crossfade — the exact
// desync this barrier removes. Pairing push/replace costs ~nothing because the
// decode wait is scoped to screens actually waking from a freeze (see
// AnimHoldReleaseOptions.decodeWait): both members of a push/replace pair skip
// the wait and the group releases at max(2rAF, 2rAF).
//
// One instance per Router scope (the binding wires that): nested Routers, and
// two scopes navigating at once, never share a group. No window/document access
// at module scope, so this is SSR-safe like the rest of the file.
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
    let group = groups.get(key);
    if (!group) {
      // ONE backstop for the whole group: if any member's decode never settles,
      // the pair still releases together at the bound (the lone-screen insurance
      // applied group-wide).
      const boundMs = backstopBoundMs(options);
      const created: AnimHoldGroup = {
        members: new Set(),
        backstop: setTimeout(() => releaseGroup(key, created), boundMs),
        backstopMs: boundMs
      };
      groups.set(key, created);
      group = created;
    } else {
      // A member whose readiness gate legitimately waits longer than the
      // group's current bound (a content settle) extends the shared backstop;
      // it stays ONE timeout for the whole group, at the longest member's
      // bound. Joins land within the paint anchor's first frames, so re-arming
      // from "now" is at most a frame or two of extra insurance.
      const boundMs = backstopBoundMs(options);
      if (boundMs > group.backstopMs) {
        clearTimeout(group.backstop);
        const extended = group;
        extended.backstopMs = boundMs;
        extended.backstop = setTimeout(() => releaseGroup(key, extended), boundMs);
      }
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
