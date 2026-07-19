// Opening clock guard: a compiled CSS animation must never lose PRESENTED
// motion to a main-thread block while its clock keeps running.
//
// The anim-hold anchors the transition's start to the entering screen's first
// painted frame, which covers the MOUNT cost. But a warm navigation carries
// ASYNC work whose commit can land between the engine's release (the style
// change that unpauses the animation) and the rendering update that carries
// it to the compositor. WebKit anchors the timeline at the release, so when
// the blocked update finally commits, the compositor picks the animation up
// DEEP into its motion — measured on a production tab crossfade as presented
// progress `0%, 0%, 0%, 0%, 87%`: the whole opening reduced to a jump.
//
// The correction window is exactly ONE frame wide. The guard's rAF is queued
// at the release, so its callback runs inside the FIRST rendering update
// that commits the unpause — before that update paints. A rewind there
// happens before the compositor has ever seen the animation: invisible, and
// it restores the swallowed opening. From that update on the compositor OWNS
// the animation and presents it straight through any later main-thread gap,
// so a rewind past the first tick snaps already-seen motion backward —
// measured on a production device as intermittent whole-screen blinks (a
// tab fade committed with clock 0, a 65ms rAF gap the compositor presented
// through, then a rewind from 65ms to 17ms replaying the fade's opening).
// Earlier full-flight and proof-of-advance designs both fell to that shape:
// clock advance is not the commit signal — a completed rendering update is.

interface GuardedElement {
  element: HTMLElement;
  // The compiled animation name this element runs; anything else on the
  // element (bars and parts are ordinary elements) is left alone.
  expectedName: string;
}

export interface OpeningClockGuardOptions {
  // Called with the rewound milliseconds when the correction fires.
  onRewind?: (totalRewindMs: number) => void;
}

// Where the first frame's clock should land: at most one frame past the
// release commit.
const FRAME_BUDGET_MS = 17;

// Advance beyond the budget that triggers the rewind. Below this the clock
// is within normal frame jitter and reanchoring would add churn for an
// imperceptible correction.
const REWIND_SLACK_MS = 24;

export interface OpeningClockGuardResult {
  cancel: () => void;
  // Milliseconds rewound by the correction. Consumers that measure elapsed
  // time against the wall clock (cancel-resume rejoin, the perceptual cut)
  // subtract this so their arithmetic tracks the PRESENTED timeline.
  appliedRewindMs: () => number;
  // Whether the correction frame has run. A guard cancelled BEFORE settling
  // did nothing — its once-per-task marker may be released so a re-armed
  // guard still gets to correct the (still unpresented) opening.
  settled: () => boolean;
}

export default function guardOpeningClock(
  participants: GuardedElement[],
  options: OpeningClockGuardOptions = {}
): OpeningClockGuardResult {
  let rewound = 0;
  let done = false;
  if (typeof requestAnimationFrame !== "function") {
    return { cancel: () => {}, appliedRewindMs: () => 0, settled: () => true };
  }

  const frame = requestAnimationFrame(() => {
    done = true;

    // The release commit is where every participant's clock begins, so the
    // first frame's budget is measured from zero. One shared clock: every
    // participant unpaused in the same commit, so the largest advance is the
    // group's lost span.
    let excess = 0;
    const matches: Animation[] = [];
    for (const { element, expectedName } of participants) {
      if (typeof element.getAnimations !== "function") continue;
      for (const animation of element.getAnimations()) {
        const name = (animation as Animation & { animationName?: string }).animationName;
        if (name !== expectedName) continue;
        if (typeof animation.currentTime !== "number") continue;
        matches.push(animation);
        excess = Math.max(excess, animation.currentTime - FRAME_BUDGET_MS);
        break;
      }
    }

    if (excess <= REWIND_SLACK_MS) return;
    for (const animation of matches) {
      try {
        animation.currentTime = Math.max(0, (animation.currentTime as number) - excess);
      } catch {
        // An animation that rejects the seek keeps its clock — the unguarded
        // behavior for that element alone.
      }
    }
    rewound = excess;
    options.onRewind?.(rewound);
  });

  return {
    cancel: () => {
      cancelAnimationFrame(frame);
    },
    appliedRewindMs: () => rewound,
    settled: () => done
  };
}
