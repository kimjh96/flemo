// Global transition-window latch: DOM-side modules that live OUTSIDE the engine's
// per-screen drive (the image decode offloader's insertion pipeline) need to
// know that a navigation is mid-transition so they can defer a visible reveal to
// its rest — the same delayed-but-complete window the arrival/response holds
// land in. The engine opens a window when it arms the running holds and
// releases it through the SAME composed release those holds use, so every
// consumption path (deferred landing, early landing, interrupt, re-arm)
// closes the window exactly when content lands.
//
// Windows nest (an interrupting navigation arms its own holds before the
// interrupted one's release runs): idle means EVERY window has closed.

let depth = 0;
let idleCallbacks: (() => void)[] = [];
let startCallbacks: (() => void)[] = [];

export function beginTransitionWindow(): () => void {
  const wasIdle = depth === 0;
  depth += 1;
  // First window of a burst: the moment CPU-heavy background work (the image
  // offloader's worker decodes on low-core Blink) must yield to the transition.
  if (wasIdle) {
    for (const callback of startCallbacks) callback();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth -= 1;
    if (depth > 0) return;
    const callbacks = idleCallbacks;
    idleCallbacks = [];
    for (const callback of callbacks) callback();
  };
}

export const transitionWindowActive = (): boolean => depth > 0;

// Subscribe to each transition burst opening (depth 0→1). Returns an unsubscribe.
// The image offloader uses it to terminate running worker decodes that
// would contend with the transition on low-core devices.
export function onTransitionWindowStart(callback: () => void): () => void {
  startCallbacks.push(callback);
  return () => {
    startCallbacks = startCallbacks.filter((c) => c !== callback);
  };
}

// Runs `callback` immediately when no transition is in progress, otherwise once
// every open window has released. Callers own their staleness (a callback may
// fire after its element's owner unmounted — make it a no-op then).
export function onTransitionWindowIdle(callback: () => void): void {
  if (depth === 0) callback();
  else idleCallbacks.push(callback);
}

/* v8 ignore next 5 -- test hook. */
export const resetTransitionWindowForTests = (): void => {
  depth = 0;
  idleCallbacks = [];
  startCallbacks = [];
};
