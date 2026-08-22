// The session's learned display cadence, in milliseconds per frame.
//
// One number, learned from the engine's in-flight rAF probe (see
// armDisplayIntervalProbe) and read by the routing that must know whether the
// panel is genuinely high-refresh:
// - the compiled tier's landing governor on touch Blink (see
//   landingGovernor.ts) engages only below COMPILED_TIER_MAX_INTERVAL_MS;
// - the governed-head keyframe selection reads the same threshold.
//
// It must be learned IN FLIGHT, not at idle: an adaptive panel (ProMotion)
// idles at 60Hz and ramps to 120Hz the moment a compositor animation runs, so
// a load-time probe reads 16.7ms on the very machine that presents at 8.3ms
// (measured: real Chrome, idle rAF 16.7ms median on a 120Hz panel). See
// steadySixtyCadence.ts, which derives its session verdict from the same
// samples.
//
// This lived inside the rAF player until the player was retired (it was the
// player's own frame-interval estimator, and the engine borrowed its output);
// the estimator went with the player, and what the compiled tier actually
// needs — the last learned interval and a way to report a fresh sample — is
// all that remains.

// 60Hz. The seed, and the ceiling: a slower reading never raises the estimate
// above nominal, so a stalled window cannot make the panel look slow enough to
// change routing.
const NOMINAL_FRAME_MS = 1000 / 60;

// Sanity bounds on an accepted sample. Below the floor is measurement noise
// (600Hz); above the ceiling is not a cadence but a stall — a display
// genuinely pacing at ~30Hz (low-power throttling, constrained embedders)
// delivers every frame at ~33ms, which is admitted, but a 100ms block is not.
const MIN_FRAME_INTERVAL_MS = 1000 / 600;
const MAX_FRAME_INTERVAL_MS = 42;

let lastLearnedIntervalMs = NOMINAL_FRAME_MS;

export const learnedFrameIntervalMs = (): number => lastLearnedIntervalMs;

export const reportDisplayIntervalMs = (intervalMs: number): void => {
  if (!Number.isFinite(intervalMs)) return;
  if (intervalMs < MIN_FRAME_INTERVAL_MS || intervalMs > MAX_FRAME_INTERVAL_MS) return;
  lastLearnedIntervalMs = Math.min(NOMINAL_FRAME_MS, Math.max(MIN_FRAME_INTERVAL_MS, intervalMs));
};

// Test seam: the module state is session-scoped by design, so a suite that
// reports a sample must be able to put it back.
export const resetDisplayCadenceForTests = (): void => {
  lastLearnedIntervalMs = NOMINAL_FRAME_MS;
};
