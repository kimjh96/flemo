// Opening clock guard: a compiled CSS animation must never lose PRESENTED
// motion to a main-thread block while its clock keeps running.
//
// The anim-hold anchors the transition's start to the entering screen's first
// painted frame, which covers the MOUNT cost. But a warm navigation carries
// ASYNC work whose commit lands a few dozen milliseconds later — a
// stale-while-revalidate refetch re-rendering a big list — squarely inside
// the flight. The engines diverge on what that block does to the animation:
//
// - Blink defers a not-yet-started animation until the blocked commit
//   completes, and its compositor keeps presenting an already-running one
//   (the glide). Either way nothing visible is lost: the motion is delayed
//   but complete — the shipped contract.
// - WebKit anchors the timeline at the release commit and, for these screen
//   animations, presents from the main thread: the block freezes pixels
//   while the clock runs, so the frame after the block sits deep into the
//   motion. Measured on a production tab crossfade as presented progress
//   `0%, 0%, 0%, 0%, 87%` — the whole opening reduced to a jump. The same
//   shape recurs MID-flight (`37% → 71% → 71% → 96%`): device evidence
//   (silent mid-commit animation cancels, the deployed mid-start report)
//   shows these fades never glide there.
//
// The guard runs an rAF ticker across the flight. Every frame it compares
// each participant's clock advance against the wall gap since the last
// frame; whatever advanced beyond one frame's worth during a gap was never
// presented — rewind it, in the same rendering update, before that frame
// paints. rAF callbacks and paint are atomic per rendering opportunity, so
// on a main-thread-presented animation a watched span can never be rewound.
// On Blink the ticker is capped to the FIRST frame (`watchMs: 0`): its
// compositor genuinely presents through rAF starvation, where a rewind
// would replay motion the viewer already saw.

interface GuardedElement {
  element: HTMLElement;
  // The compiled animation name this element runs; anything else on the
  // element (bars and parts are ordinary elements) is left alone.
  expectedName: string;
}

export interface OpeningClockGuardOptions {
  // How long past the first frame the ticker keeps watching for eaten spans
  // (the motion span, typically). 0 or absent = first-frame-only — the
  // Blink mode, and the pre-full-flight behavior.
  watchMs?: number;
  // Called with the CUMULATIVE rewound milliseconds after each correction.
  onRewind?: (totalRewindMs: number) => void;
}

// Where a frame's clock advance should land: one frame past the last one.
const FRAME_BUDGET_MS = 17;

// Advance beyond the budget that triggers a rewind. Below this the clock is
// within normal frame jitter and reanchoring would add churn for an
// imperceptible correction.
const REWIND_SLACK_MS = 24;

export interface OpeningClockGuardResult {
  cancel: () => void;
  // Cumulative milliseconds rewound so far. Consumers that measure elapsed
  // time against the wall clock (cancel-resume rejoin, the perceptual cut)
  // subtract this so their arithmetic tracks the PRESENTED timeline.
  appliedRewindMs: () => number;
  // Whether at least one correction frame has run. A guard cancelled BEFORE
  // settling did nothing — its once-per-task marker may be released so a
  // re-armed guard still gets to correct the (still unpresented) opening.
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

  const watchMs = options.watchMs ?? 0;
  // Last observed clock per participant, keyed by index. Starts at 0: the
  // release commit is where every participant's clock begins, so the first
  // frame's budget is measured from there.
  const lastClock = participants.map(() => 0);
  let cancelled = false;
  let frame = 0;
  let firstFrameAt: number | null = null;
  // A rewind needs a HEALTHY frame before the gap: an isolated block eats a
  // span nothing presented (rewind it), while a chronically slow device
  // presents EVERY frame at its low cadence — motion on schedule, just
  // choppy — and rewinding that would play the transition in slow motion.
  // One rewind per healthy→gap edge bounds the damage to one frame even if
  // the cadence heuristic ever misreads a device.
  let previousFrameHealthy = true;

  const tick = () => {
    done = true;
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : 0;
    if (firstFrameAt === null) firstFrameAt = now;

    let excess = 0;
    const clocks: (number | null)[] = participants.map(() => null);
    participants.forEach(({ element, expectedName }, index) => {
      if (typeof element.getAnimations !== "function") return;
      for (const animation of element.getAnimations()) {
        const name = (animation as Animation & { animationName?: string }).animationName;
        if (name !== expectedName) continue;
        if (typeof animation.currentTime !== "number") continue;
        clocks[index] = animation.currentTime;
        // One shared clock: every participant unpaused in the same commit,
        // so the largest never-presented advance is the group's lost span.
        excess = Math.max(excess, animation.currentTime - lastClock[index]! - FRAME_BUDGET_MS);
        break;
      }
    });

    const isGap = excess > REWIND_SLACK_MS;
    const rewinds = isGap && previousFrameHealthy;
    if (rewinds) {
      participants.forEach(({ element, expectedName }, index) => {
        if (clocks[index] === null || typeof element.getAnimations !== "function") return;
        for (const animation of element.getAnimations()) {
          const name = (animation as Animation & { animationName?: string }).animationName;
          if (name !== expectedName) continue;
          if (typeof animation.currentTime !== "number") continue;
          try {
            animation.currentTime = Math.max(0, animation.currentTime - excess);
          } catch {
            // An animation that rejects the seek keeps its clock — the
            // unguarded behavior for that element alone.
          }
          break;
        }
      });
      rewound += excess;
      options.onRewind?.(rewound);
    }
    previousFrameHealthy = !isGap;

    clocks.forEach((clock, index) => {
      if (clock !== null) {
        lastClock[index] = Math.max(0, clock - (rewinds ? excess : 0));
      }
    });

    if (!cancelled && now - firstFrameAt < watchMs) {
      frame = requestAnimationFrame(tick);
    }
  };

  frame = requestAnimationFrame(tick);

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
    appliedRewindMs: () => rewound,
    settled: () => done
  };
}
