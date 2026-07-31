// In-flight hold for INVISIBLE consumer animations.
//
// Measured on the consumer app (3s slow-mo, glass recording): a Suspense
// fallback's anti-flash skeleton — `opacity: 0` through a 500ms delay, then
// a reveal fade over sections carrying ~50 shimmer animations — keeps its
// whole subtree culled from compositing until the delay expires. The moment
// the fade starts, MID-FLIGHT, the compositor must create and raster every
// layer of that subtree at once: a 1-3 frame presentation stall with the
// renderer provably idle (no long task, no rAF gap, no commit at that
// instant). Paired A/Bs pinned it: disabling the skeleton animations removed
// the stall class; pre-rastering via `will-change: opacity` did NOT (a
// fully-transparent subtree stays culled regardless); making the subtree
// imperceptibly visible from mount spread the stall across the whole flight
// (the live shimmer layers burden the compositor continuously).
//
// So the library relocates the EVENT, not the raster: while a screen is in
// flight, every consumer animation whose target is currently invisible
// (computed opacity ≈ 0 anywhere up its chain) is paused — indistinguishable
// on glass, because the animation's output cannot be seen — and resumed in
// the same breath as the arrival-hold release, at the choreography's visual
// rest point. The layer storm then lands where nothing perceptibly moves, so
// a 1-3 frame stall cannot read as a twitch. This is the same
// delayed-but-complete contract as the arrival hold, extended from DOM
// commits to invisible animation starts. VISIBLE consumer animations are
// never touched — they run exactly as authored (the old blanket
// "consumer-animation quarantine" was removed for exactly that reason).
//
// A single scan is not enough — measured: the arming commit's animations
// don't exist until its styles apply (first scan waits a frame), and the
// arrival hold's own PARK re-inserts departing skeletons, which restarts
// their CSS animations from zero mid-flight. So this watches the scope and
// re-scans (rAF-coalesced) on every observed commit until released.

const noop = () => {};

// A scan of one flight pauses at most this many animations. A pure
// optimization bound, not a correctness deadline: an unpaused invisible
// animation simply keeps the old start-mid-flight behavior.
export const MAX_HELD_ANIMATIONS = 128;

// Below this computed opacity the subtree cannot be seen on any display
// (an 8-bit alpha step is 1/255 ≈ 0.004).
const INVISIBLE_OPACITY = 0.004;

const isInvisible = (element: Element, scope: HTMLElement): boolean => {
  const view = element.ownerDocument?.defaultView;
  if (!view) return false;
  let node: Element | null = element;
  while (node) {
    const opacity = Number(view.getComputedStyle(node).opacity);
    if (opacity <= INVISIBLE_OPACITY) return true;
    if (node === scope) break;
    node = node.parentElement;
  }
  return false;
};

// Pause invisible consumer animations under `scope` for the flight; the
// returned release resumes every animation still alive. Pausing an
// animation whose output cannot be seen changes nothing on glass; resuming
// preserves its full authored run (currentTime holds under pause), shifted
// to start at rest.
export default function createInvisibleAnimationHold(scope: HTMLElement): () => void {
  if (typeof scope.getAnimations !== "function") return noop;

  const held = new Set<Animation>();

  const scan = () => {
    for (const animation of scope.getAnimations({ subtree: true })) {
      if (held.size >= MAX_HELD_ANIMATIONS) return;
      if (held.has(animation)) continue;
      const name = (animation as Partial<CSSAnimation>).animationName ?? "";
      if (name.startsWith("flemo-")) continue;
      // Only a running animation is ours to hold: a paused one is the
      // author's (or a hold rule's) state to keep, a finished/idle one has
      // nothing to relocate.
      if (animation.playState !== "running") continue;
      const target = (animation.effect as { target?: unknown } | null)?.target;
      if (!(target instanceof Element)) continue;
      if (!isInvisible(target, scope)) continue;
      try {
        animation.pause();
        held.add(animation);
      } catch {
        // A dead/detached animation cannot pause — and needs no hold.
      }
    }
  };

  // One scan per frame at most: the arming commit's styles (and with them
  // the animations) apply after this call, so even the FIRST scan waits for
  // the next frame; every observed commit after that coalesces into the same
  // schedule. Without rAF (SSR edge) scanning immediately is the best left.
  let scheduled: number | null = null;
  const schedule = () => {
    if (typeof requestAnimationFrame !== "function") {
      scan();
      return;
    }
    if (scheduled !== null) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = null;
      scan();
    });
  };
  schedule();

  const observer = typeof MutationObserver === "function" ? new MutationObserver(schedule) : null;
  observer?.observe(scope, { subtree: true, childList: true, attributes: true });

  return () => {
    observer?.disconnect();
    if (scheduled !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(scheduled);
      scheduled = null;
    }
    for (const animation of held) {
      try {
        animation.play();
      } catch {
        // Its element left the tree during the flight; nothing to resume.
      }
    }
    held.clear();
  };
}
