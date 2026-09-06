import ensureGpuPipelinePrewarm from "@core/engine/gpuPipelinePrewarm";
import ensureImageDecodeOffloader from "@core/engine/imageDecodeOffloader";

import { resolvePlatformProfile } from "@platform/profile";

// THE AMBIENT RUNTIME.
//
// Two things flemo does that belong to the APP, not to any one screen or
// flight: keeping the GPU's pipelines compiled, and keeping oversized image
// decodes off the main thread. Neither is triggered by a navigation — they are
// the state the app sits in so that the first navigation is not the one that
// pays.
//
// They lived in the React binding, as effects plus DOM event wiring that is not
// React. A binding for another framework would have had to reimplement all of
// it to get the same motion, which is precisely the kind of thing a binding
// should not have to know. `startFlemoRuntime()` is that knowledge, moved.
//
// A THIRD used to live here: an interaction-scoped compositor warm-up that
// forced a main-thread paint every frame while the user was touching the page.
// It was removed once a same-build A/B could not find the frames it claimed to
// save (see the changeset); nothing replaced it, because nothing was lost.
//
// REFCOUNTED, because a binding may mount several Routers and each will start
// the runtime.

let holders = 0;
let stop: (() => void) | null = null;

const start = (): (() => void) => {
  const disposers: (() => void)[] = [ensureGpuPipelinePrewarm()];
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
