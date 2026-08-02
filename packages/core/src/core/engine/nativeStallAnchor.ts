// Stall re-anchoring for the NATIVE (compiled CSS) clock, on engines that
// present from the main thread (non-Blink).
//
// A compiled animation runs on the wall clock: when the main thread loses a
// few frames mid-flight, the timeline keeps advancing and the next presented
// frame shows the curve several steps ahead — a fast slide visibly "launches"
// (device-measured: a 26%-of-travel single-frame stride at 55ms into a push,
// against a healthy 11-12% easing peak). The rAF player is immune because its
// clock advances at most two frames per gap; this grafts the same semantics
// onto the native driver. Every running flemo CSS animation is also a WAAPI
// Animation, so pushing `startTime` forward by a stall's excess rewinds
// `currentTime` by exactly that much WITHOUT restarting the animation — the
// motion resumes two frames past where it stalled and plays its authored
// curve out in full, just late.
//
// The watcher runs only while a native-driven flight is active: one timestamp
// subtraction per frame, and it WRITES nothing until a stall actually happens
// — so unlike a per-frame driver it contributes no timing jitter of its own.
// On Blink the compositor keeps presenting through main-thread stalls (an rAF
// gap is NOT a presentation gap there), so shifting would yank a smoothly
// running animation backwards — the caller must gate this to non-Blink
// engines.

// The most the wall clock may advance across one frame gap before the excess
// is given back to the timeline — two nominal frames, matching the player's
// clock-step cap so both drivers degrade identically under load.
export const NATIVE_STALL_STEP_MS = 2 * (1000 / 60);

const FLEMO_ANIMATION_PREFIX = "flemo-";

// The frame timestamp of an animation's last shift. One stall freezes ONE
// shared presentation, so overlapping watchers (two engines both covering a
// participant) delivering the same frame's gap must land ONE shift, not two —
// rAF hands every same-frame callback the identical timestamp, which makes
// it the natural dedup key.
const lastShiftFrame = new WeakMap<Animation, number>();

const shiftAnimations = (element: HTMLElement, excessMs: number, frameNow: number) => {
  if (typeof element.getAnimations !== "function") return;
  for (const animation of element.getAnimations({ subtree: true })) {
    const name = (animation as CSSAnimation).animationName;
    if (typeof name !== "string" || !name.startsWith(FLEMO_ANIMATION_PREFIX)) continue;
    if (animation.playState !== "running") continue;
    if (lastShiftFrame.get(animation) === frameNow) continue;
    const startTime = animation.startTime;
    if (typeof startTime !== "number") continue;
    animation.startTime = startTime + excessMs;
    lastShiftFrame.set(animation, frameNow);
  }
};

// One anchor attempt per animation, ever: the flight-start anchor (below)
// must not rewind an animation a second effect re-run sees mid-flight — a
// healthy timeline pulled backwards is a visible jump.
const startAnchored = new WeakSet<Animation>();

// First-frame clock hold: the COMPLETE form of the flight-start anchor.
//
// The rewind (anchorNativeFlightStart) runs from a React effect, and effect
// scheduling races the very block it compensates for: when the effect
// flushes AFTER the release commit's heavy render pass, the clocks are
// already aged at collection time and are indistinguishable from a healthy
// mid-flight re-run — the opening still skips, intermittently. This hold
// removes the race by never letting the clock run before a presentable
// frame: an engine-owned MutationObserver catches the anim-hold release in
// its microtask (before the frame's style/layout/paint, regardless of what
// React schedules when), force-flushes style so the compiled animations
// exist, PAUSES the just-born ones via WAAPI, and calls play() on the next
// rAF. A pending play resolves its startTime at the first successful render
// tick — so however long the entering commit blocks, t=0 lands on the first
// frame the user actually sees, by construction. The first frame presents
// the authored from-pose (the same pose the hold was showing), so the
// handoff is seamless; the flight simply begins one presented frame later,
// which is exactly the rAF player's semantics.
// The first-frame hold's insurance for suspended rAF (background tab).
const FIRST_FRAME_BACKSTOP_MS = 1000;

// How long the hold's own early stall watcher lives. The effect-armed
// watcher takes over as soon as React flushes; this one exists to have a
// BASELINE before the release's monster frame (its first rAF runs at the
// top of that frame's rendering update, before the layout/paint block), so
// the frame's whole span becomes a measured, capped gap instead of a
// wholesale clock advance. Far past any flight; overlap with the effect's
// watcher is safe by the per-frame shift dedup.
const EARLY_WATCH_BACKSTOP_MS = 3000;

export function holdNativeClocksToFirstFrame(
  scope: HTMLElement,
  elements: () => (HTMLElement | null | undefined)[],
  onHeld?: () => void
): () => void {
  if (typeof MutationObserver === "undefined" || typeof requestAnimationFrame !== "function") {
    return () => {};
  }
  let handle = 0;
  let released = false;
  let stopEarlyWatch: (() => void) | null = null;
  const engage = () => {
    released = true;
    observer.disconnect();
    const held: Animation[] = [];
    for (const element of elements()) {
      if (!element || typeof element.getAnimations !== "function") continue;
      // getAnimations forces a style flush: the release's animations exist
      // NOW, in this microtask, with their clocks barely started.
      for (const animation of element.getAnimations({ subtree: true })) {
        const name = (animation as CSSAnimation).animationName;
        if (typeof name !== "string" || !name.startsWith(FLEMO_ANIMATION_PREFIX)) continue;
        if (animation.playState !== "running") continue;
        if (startAnchored.has(animation)) continue;
        // A just-born animation's start may still be PENDING (currentTime
        // null) — that is the freshest state of all. Only a NUMERIC clock
        // past one step marks a mid-flight animation, which must not be
        // touched.
        const currentTime = animation.currentTime;
        if (typeof currentTime === "number" && currentTime > NATIVE_STALL_STEP_MS) continue;
        try {
          animation.pause();
        } catch {
          continue;
        }
        startAnchored.add(animation);
        held.push(animation);
      }
    }
    if (held.length === 0) return;
    let backstop: ReturnType<typeof setTimeout> | null = null;
    const resume = () => {
      if (backstop !== null) clearTimeout(backstop);
      backstop = null;
      for (const animation of held) {
        try {
          if (animation.playState === "paused") animation.play();
        } catch {
          // A cancelled animation (rule un-matched, player takeover) simply
          // stays wherever its driver left it.
        }
      }
      onHeld?.();
    };
    handle = requestAnimationFrame(resume);
    // rAF suspends in background tabs; a flight must never stay frozen.
    if (typeof setTimeout === "function") backstop = setTimeout(resume, FIRST_FRAME_BACKSTOP_MS);
    // Early stall watch: baselined at the NEXT rAF — the top of the very
    // frame whose layout/paint is the entering commit's block — so that
    // frame's span is a measured gap and the capped shift converts it into
    // player-style steps instead of a swallowed opening.
    const detachWatch = watchNativeStalls(elements, () => onHeld?.());
    stopEarlyWatch = detachWatch;
    if (typeof setTimeout === "function") {
      const timer = setTimeout(() => {
        if (stopEarlyWatch === detachWatch) stopEarlyWatch = null;
        detachWatch();
      }, EARLY_WATCH_BACKSTOP_MS);
      const previous = detachWatch;
      stopEarlyWatch = () => {
        clearTimeout(timer);
        previous();
      };
    }
  };
  const observer = new MutationObserver(() => {
    if (released) return;
    if (scope.getAttribute("data-flemo-anim-hold") !== "false") return;
    engage();
  });
  // The release can beat this arming on a fast machine (the effect and the
  // release race exactly like the effect and the block do) — engage
  // immediately then: the fresh/pending gate keeps aged clocks untouched.
  if (scope.getAttribute("data-flemo-anim-hold") === "false") {
    engage();
  } else {
    observer.observe(scope, { attributes: true, attributeFilter: ["data-flemo-anim-hold"] });
  }
  return () => {
    observer.disconnect();
    if (handle) cancelAnimationFrame(handle);
    stopEarlyWatch?.();
    stopEarlyWatch = null;
    // A detach before the play tick must not leave clocks frozen.
    if (released) {
      for (const element of elements()) {
        if (!element || typeof element.getAnimations !== "function") continue;
        for (const animation of element.getAnimations({ subtree: true })) {
          if (animation.playState === "paused" && startAnchored.has(animation)) {
            try {
              animation.play();
            } catch {
              // Already cancelled: nothing to resume.
            }
          }
        }
      }
    }
  };
}

// Flight-START anchor: the gap watchNativeStalls cannot see. The stall
// watcher measures rAF-to-rAF gaps, so it needs one clean tick as a
// baseline — but the heaviest block of a navigation is the very FIRST
// frame after the hold release, where the entering screen's style, layout
// and paint all land in one render pass. The compiled clocks start at style
// time and keep running through that block, so the first frame the user
// ever sees is already deep into the curve — the swallowed opening (the
// covered screen's parallax visibly skips its 0→20% approach; the rAF
// player is immune because it anchors its clock to its own first frame).
//
// This grafts the player's semantics onto the native driver's first frame:
// at the release, every JUST-started flemo animation (aged at most one
// step — an older one belongs to an effect re-run mid-flight and must not
// be touched) is marked, and on the next rAF any marked clock that aged
// beyond one step is pulled back to exactly one step of progress. rAF runs
// before the frame's render steps, so the rewind lands before that frame
// presents. `onShift` mirrors watchNativeStalls' onStall: the engine's
// wall-clock deadlines must move with the rewound timeline.
// How long past the flight's birth the anchor keeps watching. The
// release-frame co-flush it exists for ages the clock in the FIRST rendering
// update (whose block a single next-rAF check fires BEFORE, not after —
// measured: a 300ms block injected into the release frame sailed straight
// past the one-shot form and swallowed 94% of the travel); one short window
// of frames covers that update and its immediate aftermath, then the anchor
// stands down for good so mid-flight presentation is never touched.
const START_ANCHOR_WINDOW_MS = 150;

export function anchorNativeFlightStart(
  elements: () => (HTMLElement | null | undefined)[],
  onShift?: (excessMs: number) => void
): () => void {
  /* v8 ignore next -- same rAF guard as the watcher below. */
  if (typeof requestAnimationFrame !== "function") return () => {};
  const candidates: Animation[] = [];
  const baseTimes = new Map<Animation, number>();
  for (const element of elements()) {
    if (!element || typeof element.getAnimations !== "function") continue;
    for (const animation of element.getAnimations({ subtree: true })) {
      const name = (animation as CSSAnimation).animationName;
      if (typeof name !== "string" || !name.startsWith(FLEMO_ANIMATION_PREFIX)) continue;
      if (animation.playState !== "running") continue;
      if (startAnchored.has(animation)) continue;
      const currentTime = animation.currentTime;
      if (typeof currentTime !== "number" || currentTime > NATIVE_STALL_STEP_MS) continue;
      startAnchored.add(animation);
      candidates.push(animation);
      baseTimes.set(animation, currentTime);
    }
  }
  if (candidates.length === 0) return () => {};
  // Player-clock semantics, one-shot: each observed frame gap may advance
  // the clock by at most two nominal steps (an ordinary double-vsync drop);
  // anything beyond that inside the window is a block the presentation
  // could not have followed, and the excess is given back to the timeline.
  // The FIRST rewind ends the watch — a healthy flight ends it at the
  // window bound having written nothing.
  let handle = 0;
  let cancelled = false;
  let firstTick: number | null = null;
  let lastTick: number | null = null;
  let allowanceMs = 0;
  const frame = (now: number) => {
    if (cancelled) return;
    if (firstTick === null) firstTick = now;
    if (lastTick !== null) {
      const gap = now - lastTick;
      allowanceMs += Math.min(Math.max(0, gap), NATIVE_STALL_STEP_MS);
    }
    lastTick = now;
    let shifted = 0;
    for (const animation of candidates) {
      if (animation.playState !== "running") continue;
      const currentTime = animation.currentTime;
      const startTime = animation.startTime;
      if (typeof currentTime !== "number" || typeof startTime !== "number") continue;
      const base = baseTimes.get(animation) ?? 0;
      // The slack step only decides WHETHER this is a block (a marginally
      // late healthy frame must not be touched); the rewind itself lands on
      // the allowance exactly — player semantics, at most the capped steps
      // past where the presentation stalled.
      if (currentTime <= base + allowanceMs + NATIVE_STALL_STEP_MS) continue;
      const excess = currentTime - (base + allowanceMs);
      animation.startTime = startTime + excess;
      shifted = Math.max(shifted, excess);
    }
    if (shifted > 0) {
      onShift?.(shifted);
      return;
    }
    if (now - firstTick < START_ANCHOR_WINDOW_MS) {
      handle = requestAnimationFrame(frame);
    }
  };
  handle = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    cancelAnimationFrame(handle);
  };
}

// Watches for main-thread stalls while a native-driven flight is running and
// re-anchors every flemo animation under the given elements (subtrees
// included — parts live inside screen scopes, and sibling screens carry
// their own participants). `onStall` fires after a shift so the engine can
// push its own wall-clock deadlines (the recovery watchdog, the perceptual
// cut) out of the way. Returns a detach.
export function watchNativeStalls(
  elements: () => (HTMLElement | null | undefined)[],
  onStall?: (excessMs: number) => void
): () => void {
  /* v8 ignore next -- every runtime under test has rAF; the guard shields
     exotic embedders. */
  if (typeof requestAnimationFrame !== "function") return () => {};
  let handle = 0;
  let last: number | null = null;
  let detached = false;
  const frame = (now: number) => {
    if (detached) return;
    if (last !== null) {
      const gap = now - last;
      if (gap > NATIVE_STALL_STEP_MS) {
        const excess = gap - NATIVE_STALL_STEP_MS;
        for (const element of elements()) {
          if (!element) continue;
          shiftAnimations(element, excess, now);
        }
        onStall?.(excess);
      }
    }
    last = now;
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return () => {
    detached = true;
    cancelAnimationFrame(handle);
  };
}
