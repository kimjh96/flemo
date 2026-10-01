# Module inventory

## `packages/core/src/core/engine/`

| Module | Responsibility |
| --- | --- |
| `createTransitionEngine.ts` | Per-screen lifecycle conductor: hold and armor setup, resolution, and COMPLETED cleanup. Its routing comments are the campaign ledger; read them before changing routing. |
| `flightRouting.ts` | Determines opening treatment and whether the engine may touch a flight's clock. Shares `resolveHeadKit` with the morph runtime so they cannot drift. |
| `arrivalHold.ts` | Holds mid-flight swaps, additions, and in-place writes, then reflects them at rest under the delayed-but-complete contract. |
| `responseHold.ts` | Parks nonstream fetch resolutions for all methods and delivers them in one rest batch. |
| `invisibleAnimationHold.ts` | Pauses invisible consumer animations during flights. |
| `imageDecodeHygiene.ts` | Adds `decoding="async"` to participant images while respecting authored attributes. |
| `imageDecodeOffloader.ts` | Off-main decode-to-scale for oversized images, gated on the image rather than the device. |
| `flightWindow.ts` | Global nestable flight-in-progress latch. |
| `layerSettleHold.ts` | Pins promotions and defers demotion until the flight window is idle. |
| `gpuPipelinePrewarm.ts` | One-shot boot-idle probes that compile Chrome Graphite GPU pipelines before the first flight. |
| `steadySixtyCadence.ts` | Desktop-profile cadence verdict for settle gating, unpainted image hold, and rest promotion. Does not route drivers; desktop uses compiled motion. |
| `perceptualSpan.ts` | `perceptualCutMs` and `channelValue` imperceptibility math, shared by the cut and early landing. |
| `nativeStallAnchor.ts` | Main-thread-presenting native-clock correction: birth-window `startTime` rewind, authored-native first-frame pause/play, and authored-pin continuous stall watching. |
| `emulationNotice.ts` | Once-per-session warning for DevTools device emulation, whose scaled surface fabricates shimmer. |
| `createSwipeController.ts` | Framework-neutral swipe back: 8 px intent slop; 3:1 axis arbitration before ownership; declared drag staged as scrubbed animations on screens and the bars riding them; inline mirroring for a transition driving its own screens; 6 px release tap slop; shared layer promotion. Whoever owns the screens owns the release. |
| `types.ts` | Minimal `TransitionEngineDeps` interface and `SKIP_ANIMATION_ATTR`. |

## Related modules outside `engine/`

| Module | Responsibility |
| --- | --- |
| `screen/animStartAnchor.ts` | `animHoldKey`, `scheduleAnimHoldRelease`, decode readiness, render-settle gating, and `createAnimHoldCoordinator`. |
| `screen/pendingNetwork.ts` | In-flight request accounting distinguishing loading from completed work without consumer declarations. |
| `transition/gestureScrub.ts` | Stages, scrubs, and settles paused gesture-driven animations for screens, bars, dim, and parts. |
| `transition/variantMotion.ts` | `resolveVariantMotion`, the single source for variant `{from, to, via, duration, delay, ease}` values. |
| `transition/resolveSwipeOptions.ts` | Resolves a transition's declared swipe and fills defaults so nothing downstream resolves them twice. |
| `transition/animateInline.ts` | Inline leases and imperative swipe writes. |
| `transition/compileTransitionStyles.ts` | Keyframe compiler, promotion scoping, hold and arrival rules, and LPM `-lpm` flat-head keyframes using `LPM_HEAD_MS` 180/100/80 behind `:root[data-flemo-lpm]`. Uses only `translate3d`; 2D transforms pixel-snap-stutter on Blink. Timing must remain literal because `calc(var())` animation timing demotes WebKit fades to the main thread. |
| `transition/enteringInitialStyle.ts` | Inline `from` pose for the entering screen's first styled frame; subject to the PR #259 lease invariant. |
