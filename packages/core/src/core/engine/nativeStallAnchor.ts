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
