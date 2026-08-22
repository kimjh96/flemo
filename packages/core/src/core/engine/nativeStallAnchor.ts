// Stall re-anchoring for the NATIVE (compiled CSS) clock, on engines that
// present from the main thread (non-Blink).
//
// A compiled animation runs on the wall clock: when the main thread loses a
// few frames mid-flight, the timeline keeps advancing and the next presented
// frame shows the curve several steps ahead — a fast slide visibly "launches"
// (device-measured: a 26%-of-travel single-frame stride at 55ms into a push,
// against a healthy 11-12% easing peak). The rAF player is immune because it
// caps its own clock step; this grafts the same idea onto the native driver. Every running flemo CSS animation is also a WAAPI
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
// is given back to the timeline.
//
// TWO frames. The retired rAF player used a ONE-frame allowance, narrowed
// from two on a device measurement: a 47ms GC-class blip resumed with a double
// step, seen as a 17% jump at peak velocity. This constant kept the older
// two-frame allowance, so a native stall can still resume with that double
// step. Left as measured rather than aligned blind — this path is reached only
// by an authored `driver: "native"` pin, and narrowing it deserves its own
// device round.
//
// Left at two frames deliberately for now — narrowing it changes non-Blink
// stall behavior at ~11 call sites and deserves the same kind of device round
// the player's change got, not an edit made from reading the code. When that
// round happens, derive this from the player's cap rather than restating it,
// so the two cannot drift apart again.
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
  // All resume state is FUNCTION-scoped, not trapped inside engage(), so the
  // disposer can cancel the backstop and the resume can be guarded against
  // firing after teardown. A backstop trapped in engage() would fire its
  // resume 1s after a detach — calling onHeld into a NEXT transition that has
  // since replaced the scope's disarm closures, corrupting its cut/watchdog.
  let handle = 0;
  let released = false;
  let disposed = false;
  let resumed = false;
  let backstop: ReturnType<typeof setTimeout> | null = null;
  const held: Animation[] = [];
  let stopEarlyWatch: (() => void) | null = null;

  const clearBackstop = () => {
    if (backstop !== null) {
      clearTimeout(backstop);
      backstop = null;
    }
  };

  const playHeld = () => {
    for (const animation of held) {
      try {
        if (animation.playState === "paused") animation.play();
      } catch {
        // A cancelled animation (rule un-matched, player takeover) simply
        // stays wherever its driver left it.
      }
    }
  };

  const resume = () => {
    if (disposed || resumed) return; // once only, and never after teardown
    resumed = true;
    clearBackstop();
    if (handle) {
      cancelAnimationFrame(handle);
      handle = 0;
    }
    playHeld();
    onHeld?.();
  };

  const engage = () => {
    released = true;
    observer.disconnect();
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
    handle = requestAnimationFrame(resume);
    // rAF suspends in background tabs; a flight must never stay frozen.
    if (typeof setTimeout === "function") backstop = setTimeout(resume, FIRST_FRAME_BACKSTOP_MS);
    // Early stall watch: baselined at the NEXT rAF — the top of the very
    // frame whose layout/paint is the entering commit's block — so that
    // frame's span is a measured gap and the capped shift converts it into
    // player-style steps instead of a swallowed opening. Guarded against a
    // post-teardown fire like every other onHeld path.
    const detachWatch = watchNativeStalls(elements, () => {
      if (!disposed) onHeld?.();
    });
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
    disposed = true;
    observer.disconnect();
    if (handle) {
      cancelAnimationFrame(handle);
      handle = 0;
    }
    clearBackstop(); // the internal backstop must never fire a stale resume
    stopEarlyWatch?.();
    stopEarlyWatch = null;
    // A detach before the play tick must not leave clocks frozen — but if the
    // resume already ran, they're playing, so do this only when it hasn't.
    if (released && !resumed) playHeld();
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

// The hold guard: how far into the future the first tick dates each clock.
// Far beyond any release block (device-measured blocks run 50-150ms, the
// injected worst case 300ms), and given back IN FULL at the restore tick —
// its magnitude never reaches the glass, only the from-pose hold does.
const START_HOLD_GUARD_MS = 4000;

// If the restore tick never comes (rAF suspends — a backgrounded tab right
// at flight birth), the guard must not strand the animation 4s in the
// future: a wall-clock backstop restores it the same way.
const START_HOLD_BACKSTOP_MS = 400;

export function anchorNativeFlightStart(
  elements: () => (HTMLElement | null | undefined)[],
  onShift?: (excessMs: number) => void,
  // Whether the two-phase hold applies. TRUE for slides (PUSHING/POPPING),
  // where the from pose IS what the glass already shows, so the hold frame
  // is invisible and the swallowed opening it prevents is the probe-measured
  // 15-22% skip. FALSE for REPLACING: a tab switch's exiting screen holds at
  // FULL presence over the already-committed new content — device-seen as
  // the old screen flashing back — and its quick cross-fade has no tracked
  // opening to protect; the legacy one-shot rewind is the right medicine.
  holdFirstFrame = true,
  // FIRST-TICK-ONLY mode, for rAF-capped sessions (iOS Low Power Mode). LPM
  // caps rAF ~30Hz while the compositor keeps presenting at panel rate, so
  // every gap-based watch here reads a healthy flight as a stall: the
  // co-flush window's allowance (capped at one step per tick) falls behind
  // wall time within 2-3 ticks and rewinds an animation the user has ALREADY
  // watched reach 40-60% of travel — device-measured (iPhone LPM, 2026-08)
  // as a backward jump on every push, up to 570 device px. The one
  // correction that IS safe lands at the first tick: the anchor's rAF is
  // requested in the release microtask, so its first tick tops the very
  // rendering update whose paint first commits the animation — nothing has
  // presented yet, and the clock's aging (release microtask style flush →
  // this update, one full LPM frame of 33-62ms) is exactly the swallowed
  // opening. Rewind it to one step there, invisibly, then stand down: every
  // later tick's eyes are capped and must not touch the clock.
  firstTickOnly = false
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
      // A just-born animation's start may still be PENDING (currentTime
      // null) — the freshest state of all (the hold's own gate treats it
      // the same way). Only a NUMERIC clock past one step marks a
      // mid-flight animation, which must not be touched.
      const currentTime = animation.currentTime;
      if (typeof currentTime === "number" && currentTime > NATIVE_STALL_STEP_MS) continue;
      if (currentTime !== null && typeof currentTime !== "number") continue;
      startAnchored.add(animation);
      candidates.push(animation);
      baseTimes.set(animation, typeof currentTime === "number" ? currentTime : 0);
    }
  }
  if (candidates.length === 0) return () => {};
  // TWO-PHASE anchor. The one-shot rewind form was probe-falsified on device
  // (iPhone, 2026-08): the release rendering update's style/layout/paint
  // block ages the clock BETWEEN the first rAF and its own present, so the
  // first frame the user sees is already 15-22% into the curve and the
  // rewind lands one frame later as a visible backward snap. The aging is
  // unavoidable — but its PRESENTATION isn't:
  //   HOLD (first tick, before the block): future-date every clock by the
  //   guard. The block's present then shows the FROM pose (fill backwards) —
  //   identical to the park pose already on glass, so nothing changes.
  //   RESTORE (next tick, block behind us): give the guard back so each
  //   clock sits at exactly base + the capped allowance — the opening plays
  //   in full from its first REAL presented frame. A healthy flight's
  //   restore is a numeric no-op (guard out, one frame's allowance in), so
  //   the hold costs it nothing but one from-pose frame.
  // Then the allowance watch continues for the co-flush window, unchanged.
  let handle = 0;
  let backstop: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let held = false;
  let restored = false;
  let firstTick: number | null = null;
  let lastTick: number | null = null;
  let allowanceMs = 0;
  const restoreGuard = (allowance: number) => {
    if (restored) return 0;
    restored = true;
    let shifted = 0;
    for (const animation of candidates) {
      if (animation.playState !== "running") continue;
      const currentTime = animation.currentTime;
      const startTime = animation.startTime;
      if (typeof currentTime !== "number" || typeof startTime !== "number") continue;
      const base = baseTimes.get(animation) ?? 0;
      const desired = base + allowance;
      // Increasing startTime decreases currentTime and vice versa; land the
      // clock exactly on `desired`, wherever the guard + block left it.
      animation.startTime = startTime + (currentTime - desired);
      baseTimes.set(animation, desired);
      const natural = currentTime + START_HOLD_GUARD_MS;
      shifted = Math.max(shifted, natural - desired);
    }
    return shifted;
  };
  const frame = (now: number) => {
    if (cancelled) return;
    if (firstTick === null) firstTick = now;
    if (lastTick !== null) {
      const gap = now - lastTick;
      allowanceMs += Math.min(Math.max(0, gap), NATIVE_STALL_STEP_MS);
    }
    lastTick = now;
    if (!held) {
      held = true;
      if (firstTickOnly) {
        // Pre-presentation birth rewind (see the parameter note): pull every
        // clock that aged past one step back to exactly one step, before
        // this update's paint first commits it to the compositor. A pending
        // clock (startTime unresolved) anchors itself to the first render
        // tick natively and needs nothing. Then stand down for good.
        // `restored` blocks the disposer's restoreGuard — a teardown-time
        // clock write is exactly the backward jump this mode exists to end.
        restored = true;
        let shifted = 0;
        for (const animation of candidates) {
          if (animation.playState !== "running") continue;
          const currentTime = animation.currentTime;
          const startTime = animation.startTime;
          if (typeof currentTime !== "number" || typeof startTime !== "number") continue;
          const base = baseTimes.get(animation) ?? 0;
          if (currentTime <= base + NATIVE_STALL_STEP_MS) continue;
          const excess = currentTime - (base + NATIVE_STALL_STEP_MS);
          animation.startTime = startTime + excess;
          shifted = Math.max(shifted, excess);
        }
        if (shifted > 0) onShift?.(shifted);
        return;
      }
      if (!holdFirstFrame) {
        restored = true; // straight to the co-flush watch (legacy semantics)
        handle = requestAnimationFrame(frame);
        return;
      }
      for (const animation of candidates) {
        if (animation.playState !== "running") continue;
        const startTime = animation.startTime;
        if (typeof startTime === "number") {
          animation.startTime = startTime + START_HOLD_GUARD_MS;
          continue;
        }
        // PENDING start (startTime null — the clock resolves at the first
        // render tick, i.e. AFTER the block this hold exists for): pin an
        // explicit future start off the document timeline instead, the same
        // guard by another route.
        const timelineNow = animation.timeline?.currentTime;
        if (typeof timelineNow === "number") {
          animation.startTime = timelineNow + START_HOLD_GUARD_MS;
        }
      }
      /* v8 ignore next 3 -- setTimeout exists in every runtime under test. */
      if (typeof setTimeout === "function") {
        backstop = setTimeout(
          () => restoreGuard(allowanceMs + NATIVE_STALL_STEP_MS),
          START_HOLD_BACKSTOP_MS
        );
      }
      handle = requestAnimationFrame(frame);
      return;
    }
    if (!restored) {
      if (backstop !== null) clearTimeout(backstop);
      const shifted = restoreGuard(allowanceMs);
      allowanceMs = 0;
      if (shifted > NATIVE_STALL_STEP_MS) onShift?.(shifted);
      handle = requestAnimationFrame(frame);
      return;
    }
    // Co-flush watch (unchanged semantics): a late block inside the window
    // still rewinds to the allowance; the first rewind ends the watch.
    let shifted = 0;
    for (const animation of candidates) {
      if (animation.playState !== "running") continue;
      const currentTime = animation.currentTime;
      const startTime = animation.startTime;
      if (typeof currentTime !== "number" || typeof startTime !== "number") continue;
      const base = baseTimes.get(animation) ?? 0;
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
    if (backstop !== null) clearTimeout(backstop);
    // A detach between hold and restore must not strand clocks in the
    // future — give the guard back with the same one-step allowance.
    if (held && !restored) restoreGuard(allowanceMs + NATIVE_STALL_STEP_MS);
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

// One armed record per scope, REFCOUNTED with a zero-delay teardown grace:
// the drive effect re-runs at the release (cleanup, then re-arm, same
// commit), and a plain per-run observer would be torn down at exactly the
// moment it exists for — the release microtask. The grace carries the armed
// observer across the re-run; onShift is read through the caller's per-scope
// slot so the surviving record always disarms the CURRENT run's deadlines.
interface ReleaseAnchorRecord {
  refs: number;
  pendingDrop: ReturnType<typeof setTimeout> | null;
  dispose: () => void;
}
const releaseAnchors = new WeakMap<HTMLElement, ReleaseAnchorRecord>();

export function armFlightStartAnchorAtRelease(
  scope: HTMLElement,
  elements: () => (HTMLElement | null | undefined)[],
  onShift?: (excessMs: number) => void,
  holdFirstFrame = true,
  firstTickOnly = false
): () => void {
  if (typeof MutationObserver === "undefined" || typeof requestAnimationFrame !== "function") {
    return () => {};
  }
  const existing = releaseAnchors.get(scope);
  if (existing) {
    existing.refs += 1;
    if (existing.pendingDrop !== null) {
      clearTimeout(existing.pendingDrop);
      existing.pendingDrop = null;
    }
    return () => releaseRef(scope);
  }
  let detachAnchor: (() => void) | null = null;
  let engaged = false;
  let disposed = false;
  const engage = () => {
    if (engaged || disposed) return;
    engaged = true;
    observer.disconnect();
    detachAnchor = anchorNativeFlightStart(elements, onShift, holdFirstFrame, firstTickOnly);
  };
  const observer = new MutationObserver(() => {
    if (scope.getAttribute("data-flemo-anim-hold") !== "false") return;
    engage();
  });
  if (scope.getAttribute("data-flemo-anim-hold") === "false") {
    // Already released at arm time (a hold-free variant, or the arming lost
    // the race): engage NOW — the anchor's first rAF still tops the coming
    // update when this runs inside the release commit's own task.
    engage();
  } else {
    observer.observe(scope, { attributes: true, attributeFilter: ["data-flemo-anim-hold"] });
  }
  const record: ReleaseAnchorRecord = {
    refs: 1,
    pendingDrop: null,
    dispose: () => {
      disposed = true;
      observer.disconnect();
      detachAnchor?.();
      releaseAnchors.delete(scope);
    }
  };
  releaseAnchors.set(scope, record);
  return () => releaseRef(scope);
}

const releaseRef = (scope: HTMLElement) => {
  const record = releaseAnchors.get(scope);
  if (!record) return;
  record.refs -= 1;
  if (record.refs > 0) return;
  /* v8 ignore next 4 -- setTimeout exists in every runtime under test. */
  if (typeof setTimeout !== "function") {
    record.dispose();
    return;
  }
  if (record.pendingDrop !== null) clearTimeout(record.pendingDrop);
  record.pendingDrop = setTimeout(record.dispose, 0);
};
