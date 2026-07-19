// Opening clock guard: a compiled CSS animation must never lose its OPENING
// to a main-thread block that lands right after the anim-hold release.
//
// The anim-hold anchors the transition's start to the entering screen's first
// painted frame, which covers the MOUNT cost. But a warm navigation carries
// ASYNC work whose commit lands a few dozen milliseconds later — a
// stale-while-revalidate refetch re-rendering a big list — squarely inside
// the flight. The two engines diverge on what that block does to a
// just-unpaused CSS animation:
//
// - Blink defers the compositor start until the blocked commit completes: the
//   motion starts late but plays in full (delayed-but-complete — the shipped
//   contract).
// - WebKit anchors the timeline at the release commit. The block delays the
//   first PRESENTED frame while the clock runs, so the first frame the eye
//   sees is already deep into the motion — measured on a production tab
//   switch as the first presented frame at 73% of a 150ms fade ("the
//   transition starts past its middle").
//
// The correction is one rAF long. The first animation frame after the
// release is the first moment anything can present; if the animation's clock
// has advanced far beyond one frame by then, that span was never displayed —
// rewind it. The arithmetic self-discriminates between engines: on Blink the
// deferred animation has barely advanced (nothing to rewind), on WebKit the
// eaten opening is exactly the excess. After this first frame the animation
// is committed to the compositor, which glides through later main-thread
// blocks on both engines — so the guard disarms itself immediately, and a
// mid-flight rewind of motion the viewer already watched is impossible by
// construction.

interface GuardedElement {
  element: HTMLElement;
  // The compiled animation name this element runs; anything else on the
  // element (a consumer animation on the scope is impossible, but bars and
  // parts are ordinary elements) is left alone.
  expectedName: string;
}

// Where the first presented frame should land on the animation's clock: one
// frame in.
const FIRST_FRAME_MS = 17;

// Advancement beyond FIRST_FRAME_MS that triggers the rewind. Below this the
// clock is within normal frame jitter and reanchoring would add churn for an
// imperceptible correction.
const REWIND_SLACK_MS = 24;

export interface OpeningClockGuardResult {
  cancel: () => void;
  // Milliseconds the guard rewound the shared clock (0 until the frame runs).
  // Consumers that measure elapsed time against the wall clock (cancel-resume
  // rejoin, the perceptual cut) subtract this so their arithmetic tracks the
  // PRESENTED timeline, not the wall.
  appliedRewindMs: () => number;
  // Whether the correction frame has run. A guard cancelled BEFORE settling
  // did nothing — its once-per-task marker may be released so a re-armed
  // guard still gets to correct the (still unpresented) opening.
  settled: () => boolean;
}

export default function guardOpeningClock(
  participants: GuardedElement[],
  onRewind?: (rewindMs: number) => void
): OpeningClockGuardResult {
  let rewound = 0;
  let done = false;
  if (typeof requestAnimationFrame !== "function") {
    return { cancel: () => {}, appliedRewindMs: () => 0, settled: () => true };
  }

  const frame = requestAnimationFrame(() => {
    done = true;
    let excess = 0;
    const animations: Animation[] = [];
    for (const { element, expectedName } of participants) {
      if (typeof element.getAnimations !== "function") continue;
      for (const animation of element.getAnimations()) {
        const name = (animation as Animation & { animationName?: string }).animationName;
        if (name !== expectedName) continue;
        if (typeof animation.currentTime !== "number") continue;
        animations.push(animation);
        // One shared clock: every participant unpaused in the same commit, so
        // the largest observed advancement is the group's lost span.
        excess = Math.max(excess, animation.currentTime - FIRST_FRAME_MS);
      }
    }
    if (excess <= REWIND_SLACK_MS) return;
    for (const animation of animations) {
      try {
        animation.currentTime = Math.max(0, (animation.currentTime as number) - excess);
      } catch {
        // An animation that rejects the seek keeps its clock — the
        // pre-guard behavior for that element alone.
      }
    }
    rewound = excess;
    onRewind?.(excess);
  });

  return {
    cancel: () => cancelAnimationFrame(frame),
    appliedRewindMs: () => rewound,
    settled: () => done
  };
}
