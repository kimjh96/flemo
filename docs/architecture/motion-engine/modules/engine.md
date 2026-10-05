# Engine modules

Modules in `packages/core/src/core/engine/`:

| Module | Responsibility |
| --- | --- |
| `createTransitionEngine.ts` | Per-screen lifecycle conductor: hold and armor setup, resolution, and COMPLETED cleanup. Its routing comments are the campaign ledger; read them before changing routing. |
| `transitionRouting.ts` | Determines opening treatment and whether the engine may touch a transition's clock. Shares `resolveHeadKit` with the morph runtime to prevent drift. |
| `headGate.ts` | Holds the page-wide desktop head gate still while any transition runs under it, so a transition starting in another Router routes with the same answer instead of flipping the root attribute and restarting the running animation. |
| `arrivalHold.ts` | Holds mid-transition swaps, additions, and in-place writes, then reflects them at rest under the delayed-but-complete contract. |
| `responseHold.ts` | Parks nonstream fetch resolutions for all methods and delivers them in one rest batch. |
| `invisibleAnimationHold.ts` | Pauses invisible consumer animations during transitions. |
| `imageDecodeHygiene.ts` | Adds `decoding="async"` to participant images while respecting authored attributes. |
| `imageDecodeOffloader.ts` | Off-main decode-to-scale for oversized images, gated on the image rather than the device. |
| `transitionWindow.ts` | Global nestable transition-in-progress latch. |
| `layerSettleHold.ts` | Pins promotions and defers demotion until the transition window is idle. |
| `gpuPipelinePrewarm.ts` | One-shot boot-idle probes that compile Chrome Graphite GPU pipelines before the first transition. |
| `steadySixtyCadence.ts` | Desktop-profile cadence verdict for settle gating, unpainted image hold, and rest promotion. Does not route drivers; desktop uses compiled motion. |
| `perceptualSpan.ts` | `perceptualCutMs` and `channelValue` imperceptibility math shared by the cut and early landing. |
| `nativeStallAnchor.ts` | Main-thread-presenting native-clock correction: birth-window `startTime` rewind, authored-native first-frame pause/play, and authored-pin continuous stall watching. |
| `emulationNotice.ts` | Once-per-session warning for DevTools device emulation, whose scaled surface fabricates shimmer. |
| `createSwipeController.ts` | Framework-neutral swipe back: 8 px intent slop; 3:1 axis arbitration before ownership; declared drag staged as scrubbed animations on screens and the bars riding them; inline mirroring for a transition driving its own screens; 6 px release tap slop; shared layer promotion. Whoever owns the screens owns the release. |
| `types.ts` | Minimal `TransitionEngineDeps` interface and `SKIP_ANIMATION_ATTR`. |
