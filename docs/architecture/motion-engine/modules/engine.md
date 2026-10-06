# Engine modules

Modules in `packages/core/src/core/engine/`:

| Module | Responsibility |
| --- | --- |
| `createTransitionEngine.ts` | Conducts per-screen lifecycle: hold and armor setup, resolution, and COMPLETED cleanup. Routing comments are the campaign ledger; read them before changing routing. |
| `transitionRouting.ts` | Determines opening treatment and whether the engine may touch a transition's clock. Shares `resolveHeadKit` with the morph runtime to prevent drift. |
| `headGate.ts` | Keeps the page-wide desktop head gate unchanged while any transition runs under it. A transition starting in another Router gets the same routing answer, avoiding a root attribute flip that restarts the running animation. |
| `arrivalHold.ts` | Holds mid-transition swaps, additions, and in-place writes, then reflects them at rest under the delayed-but-complete contract. |
| `responseHold.ts` | Parks nonstream fetch resolutions for all methods and delivers them in one rest batch. |
| `invisibleAnimationHold.ts` | Pauses invisible consumer animations during transitions. |
| `imageDecodeHygiene.ts` | Adds `decoding="async"` to participant images while respecting authored attributes. |
| `imageDecodeOffloader.ts` | Performs off-main decode-to-scale for oversized images, gated on the image rather than the device. |
| `transitionWindow.ts` | Provides the global nestable transition-in-progress latch. |
| `layerSettleHold.ts` | Pins promotions and defers demotion until the transition window is idle. |
| `gpuPipelinePrewarm.ts` | Runs one-shot boot-idle probes to compile Chrome Graphite GPU pipelines before the first transition. |
| `steadySixtyCadence.ts` | Provides the desktop-profile cadence verdict for settle gating, unpainted image hold, and rest promotion. Does not route drivers; desktop uses compiled motion. |
| `perceptualSpan.ts` | Shares `perceptualCutMs` and `channelValue` imperceptibility math between the cut and early landing. |
| `nativeStallAnchor.ts` | Corrects main-thread-presenting native clocks through birth-window `startTime` rewind, authored-native first-frame pause/play, and authored-pin continuous stall watching. |
| `emulationNotice.ts` | Warns once per session about DevTools device emulation, whose scaled surface fabricates shimmer. |
| `createSwipeController.ts` | Provides framework-neutral swipe back: 8 px intent slop; 3:1 axis arbitration before ownership; declared drag staged as scrubbed animations on screens and their riding bars; inline mirroring for a transition driving its own screens; 6 px release tap slop; shared layer promotion. Whoever owns the screens owns the release. |
| `types.ts` | Defines the minimal `TransitionEngineDeps` interface and `SKIP_ANIMATION_ATTR`. |
