import holdCompositorWarm from "@core/engine/compositorWarmUp";
import ensureGpuPipelinePrewarm from "@core/engine/gpuPipelinePrewarm";
import ensureImageDecodeOffloader from "@core/engine/imageDecodeOffloader";

import { resolvePlatformProfile } from "@platform/profile";

// THE AMBIENT RUNTIME.
//
// Three things flemo does that belong to the APP, not to any one screen or
// flight: keeping the GPU's pipelines compiled, keeping oversized image decodes
// off the main thread, and keeping the compositor awake while the user is about
// to navigate. None of them is triggered by a navigation — they are the state
// the app sits in so that the first navigation is not the one that pays.
//
// They lived in the React binding, as three effects plus forty lines of DOM
// event wiring, a throttle and a tail timer — none of which is React. A binding
// for another framework would have had to reimplement all of it to get the same
// motion, which is precisely the kind of thing a binding should not have to
// know. `startFlemoRuntime()` is that knowledge, moved.
//
// REFCOUNTED, because a binding may mount several Routers and each will start
// the runtime. Previously each also installed its own document listener set;
// now nested Routers share one.

/**
 * Renew the compositor hold at most this often. Interaction events fire per
 * frame, and each renewal is a real hold acquisition.
 */
const INTERACTION_WARM_RENEW_MS = 500;

/**
 * How long the hold outlives the last interaction. Long enough to cover the
 * gap between a pointer settling and the tap that follows it.
 */
const INTERACTION_WARM_TAIL_MS = 3000;

/**
 * Interactions that precede a navigation. A pointer moving toward a target
 * precedes the tap by seconds, which is the margin this is buying.
 */
const INTERACTION_EVENTS = [
  "pointerdown",
  "pointermove",
  "wheel",
  "touchstart",
  "keydown"
] as const;

/**
 * Pre-warm the compositor while the user INTERACTS.
 *
 * The per-flight warm-up starts WITH the flight, so the first navigation after
 * an idle period still pays the pipeline's wake-up (frame clock, GPU power
 * state) inside its opening frames — observed as a first-journey judder that
 * disappears while a Performance recording (a continuous frame producer) runs,
 * and measured to survive a press-scoped warm: the wake costs more than the
 * 50-300ms a press precedes its navigation by.
 *
 * So the warm rides ANY interaction, renewed at most twice a second and
 * released a short tail after the interaction stops. This reproduces what the
 * recording does, but only while the user is actually about to do something.
 */
const startInteractionWarmUp = (): (() => void) => {
  if (typeof document === "undefined") return () => {};

  let release: (() => void) | null = null;
  let tail: ReturnType<typeof setTimeout> | null = null;
  let lastRenewal = 0;

  const renew = () => {
    const now = Date.now();
    if (now - lastRenewal < INTERACTION_WARM_RENEW_MS) return;
    lastRenewal = now;
    if (tail) clearTimeout(tail);
    // Overlapping holds are refcounted and each carries the warm-up's own
    // backstop, so a long interaction has to keep re-taking one. Take the new
    // hold BEFORE releasing the old, or the warm-up drops to zero holders
    // between the two and tears its element down.
    const previous = release;
    release = holdCompositorWarm();
    previous?.();
    tail = setTimeout(() => {
      tail = null;
      release?.();
      release = null;
    }, INTERACTION_WARM_TAIL_MS);
  };

  for (const type of INTERACTION_EVENTS) {
    document.addEventListener(type, renew, { passive: true });
  }
  return () => {
    for (const type of INTERACTION_EVENTS) document.removeEventListener(type, renew);
    if (tail) clearTimeout(tail);
    release?.();
  };
};

let holders = 0;
let stop: (() => void) | null = null;

const start = (): (() => void) => {
  const disposers: (() => void)[] = [startInteractionWarmUp(), ensureGpuPipelinePrewarm()];
  // Whether this runs at all is the platform profile's call — it rewrites
  // consumer <img> sources, so it must never engage where the paint is cheap.
  if (resolvePlatformProfile().imageDecodeOffload) disposers.push(ensureImageDecodeOffloader());
  return () => {
    for (const dispose of disposers) dispose();
  };
};

/**
 * Start flemo's ambient machinery, and return the release for this holder.
 *
 * A binding calls this once per Router mount and releases on unmount. Repeat
 * calls share one runtime; the last release tears it down. Safe on the server:
 * every piece degrades to a no-op without a document.
 */
export const startFlemoRuntime = (): (() => void) => {
  if (holders === 0) stop = start();
  holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders > 0) return;
    stop?.();
    stop = null;
  };
};

/* v8 ignore next 5 -- test hook: the runtime is process-scoped by design. */
export const resetFlemoRuntimeForTests = (): void => {
  stop?.();
  stop = null;
  holders = 0;
};
