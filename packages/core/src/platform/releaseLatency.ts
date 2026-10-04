// How long this session takes to put a transition's FIRST FRAME on the glass, per
// navigation status, in milliseconds.
//
// The flat head exists to cover exactly this: a compiled clock is born at the
// release update's style resolution, but its first frame reaches the glass only
// after that update's paint, the compositor's commit and the display's next
// vsync. The head holds the authored from-pose across that gap so the curve
// PLAYS from 0 rather than being entered partway.
//
// A head is therefore a cover for a latency, and a cover for a latency that is
// not there is dead time: the screen sits still after it could already have
// moved. The lengths are literal in the compiled CSS and cannot be dialled per
// transition, so what is decided per transition is whether to wear one at all — and
// that is a question about a measured number, not about a platform.
//
// Measured rather than assumed, because the number is a property of the app,
// not of the browser. On a bench whose arriving screen renders in 22ms the
// first frame reaches glass at 28.5ms and the head is earning its keep; on an
// app whose screens are already mounted it is a frame, and the same head would
// be twenty milliseconds of stillness bought for nothing.
//
// One number per status, and the WORST of what has been seen rather than the
// average: the head has to cover the bad navigation, and a run of cheap ones
// must not talk it down into uncovering the expensive one. It decays, so an app
// that got faster (a route warmed, a font settled) stops paying for the state it
// has left behind.

/** Sanity bounds on a sample. A stall is not a latency. */
const MIN_SAMPLE_MS = 0;
const MAX_SAMPLE_MS = 250;

/** How much of the remembered worst survives each later, cheaper transition. */
const DECAY = 0.85;

const learned = new Map<string, number>();

/**
 * What this session has been seen to take, for this status, or null where it
 * has not been measured yet.
 *
 * Null is not zero: an unmeasured status has to be covered, because the first
 * navigation of a session is the one most likely to be slow.
 */
export const learnedReleaseLatencyMs = (status: string): number | null =>
  learned.get(status) ?? null;

/** One transition's release-to-first-frame, as measured by the engine. */
export const reportReleaseLatencyMs = (status: string, latencyMs: number): void => {
  if (!Number.isFinite(latencyMs)) return;
  if (latencyMs < MIN_SAMPLE_MS || latencyMs > MAX_SAMPLE_MS) return;
  const before = learned.get(status);
  // Rise to a worse reading at once; fall towards a better one slowly.
  learned.set(status, before === undefined ? latencyMs : Math.max(latencyMs, before * DECAY));
};

// Test seam: the module state is session-scoped by design, so a suite that
// reports a sample must be able to put it back.
export const resetReleaseLatencyForTests = (): void => {
  learned.clear();
};
