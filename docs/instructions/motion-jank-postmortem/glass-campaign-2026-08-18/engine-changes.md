# Device-correlated engine changes and fixed defects

## Engine changes that improved motion

1. PR #251's compiled landing-governor easing caused the reported desktop pop rattle (“드르륵”). Removed for desktop; authored easing runs untouched.
2. For steady-60 desktops, arrival-hold early landing moved off the transition to release at rest, fixing the per-push skipped frame at the perceptual cut.
3. Pre-raster (will-change through the hold) became the steady-60 desktop default, fixing push stutter (“뚝뚝”) from mid-slide tile rasterization of the occluded parked layer.

## Real defects fixed on this branch

1. **Warm-side running image decode:** departing-list lazy avatars decode and re-raster over the sliding layer. CDP presentation established causality: 1 decode = 1 skip (1:1). Fix: extend unpainted-only image hold to warm participants.
2. **Release swallow (desktop-Blink-compiled):** the state-routed release's clock/first-frame gap appears on glass as freeze then jump into mid-curve. Fix: atomize release with flushSync inside the readiness rAF, generalizing the WebKit atomic flip. The flip itself remains non-Blink only.
3. **Release race (all drivers):** a commit between flip and state commit rewrites stale hold properties, pausing the running animation for about 250ms. This explained “sometimes it's clean.” Fix: flushSync unification removes the window entirely.
4. **Image-hold double-capture leak:** consecutive transition holds capture each other's display:none as the original, leaving loaded avatars permanently blank (130 of 150 reproduced). Fix: attribute-marker-based single-owner guard.
5. **arrivalHold × image-hold cross race:** in-place freeze reverts hold style writes mid-transition, disarming the hold, then replays them at rest, causing orphan hiding (about 100/pop). Fix: freeze excludes the style channel of hold marker elements.
6. **GPU pipeline cold-compile coverage hole:** a fresh profile's first transition carries 120–150ms GPU-channel raster tasks, measured in trace. Existing prewarm omitted image textures, circular clips, gradients, CJK glyphs, hairlines, and shadow variants. Fix: expand the scene; trace A/B confirmed task disappearance.
7. **Freeze timing thrash:** a push landing's hide overlaps a fast pop's unhide. Fix: ScreenFreeze debounce (3s) skips the freeze itself for fast round trips.

consumerAnimationPause was fully withdrawn by user instruction. Standing principle: flemo does not touch consumer-authored state.
