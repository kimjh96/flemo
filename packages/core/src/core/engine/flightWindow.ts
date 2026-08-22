// Global flight-window latch: DOM-side modules that live OUTSIDE the engine's
// per-screen drive (the image decode offloader's insertion pipeline) need to
// know that a navigation is mid-flight so they can defer a visible reveal to
// its rest — the same delayed-but-complete window the arrival/response holds
// land in. The engine opens a window when it arms the in-flight holds and
// releases it through the SAME composed release those holds use, so every
// consumption path (deferred landing, early landing, interrupt, re-arm)
// closes the window exactly when content lands.
//
// Windows nest (an interrupting navigation arms its own holds before the
// interrupted one's release runs): idle means EVERY window has closed.

let depth = 0;
let idleCallbacks: (() => void)[] = [];

export function beginFlightWindow(): () => void {
  depth += 1;
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

export const flightWindowActive = (): boolean => depth > 0;

// Runs `callback` immediately when no flight is in progress, otherwise once
// every open window has released. Callers own their staleness (a callback may
// fire after its element's owner unmounted — make it a no-op then).
export function onFlightWindowIdle(callback: () => void): void {
  if (depth === 0) callback();
  else idleCallbacks.push(callback);
}

/* v8 ignore next 5 -- test hook. */
export const resetFlightWindowForTests = (): void => {
  depth = 0;
  idleCallbacks = [];
};
