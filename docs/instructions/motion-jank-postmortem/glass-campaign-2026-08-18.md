# 2026-08-18: the glass-measurement campaign and the recorder artifact

Instrument lessons, confirmed defects, and the verdict protocol from a one-day
closed-loop glass-measurement campaign: 42 live builds (j2–j42) judged on real
devices, driven with `screencapture -v` plus per-frame motion/pts analysis.

## Verdict protocol (binding)

- Transition quality judgments must be made with DevTools closed, without capture, with real input.
- Any single-frame-level verdict taken through `screencapture -v` is void.

## Recorder artifact — the lesson that must not be re-learned

- **`screencapture -v` (VFR, window or display) injects a metronomic ~1-frame "drop" every ~400ms.** It appears as a 33ms pts gap during continuous motion and is indistinguishable from a real dropped frame. Proven by parity: the identical periodic pattern appears in Chromium, in Playwright-WebKit, in REAL Safari (the user's smooth reference), and in a zero-JS pure-CSS compositor slide.
- Playwright's WebKit port is NOT a Safari smoothness proxy — it measured worse than Chromium on the same harness.
- macOS Spaces: `screencapture -v` (display mode) records the ACTIVE space, so a fullscreen IDE means the driven browser is off-glass and possibly throttled. Window-id mode (`-v -l<id>`) captures across spaces but still carries the VFR artifact. AVFoundation CFR capture also sees only the active space.
- Net: after the governor removal, rest-side arrival release, and pre-raster rounds, Chromium pristine-compiled == real Safari == pure-CSS control at every layer measurable in-machine. The only instruments that can go deeper are a visible-space CFR capture (needs the space on glass) or an external camera.

## Engine changes that DID move the needle (all device-correlated)

1. PR #251's compiled landing-governor easing was itself the reported desktop pop "드르륵" — removed for desktop; authored easing runs untouched.
2. Arrival-hold early landing moved off the flight (release at rest) for steady-60 desktops — the per-push skipped frame at the perceptual cut.
3. Pre-raster (will-change through the hold) default for steady-60 desktops — the push "뚝뚝" from mid-slide tile rasterization of the occluded parked layer.

## Campaign instrumentation

Display capture (CFR/AVFoundation, VFR/QuickTime), badge markers (flight window /
release colour inversion), a pose encoder (greyscale recording of progress), CDP
traces (presentation feedback), and displacement cross-correlation profiles.

## Real defects, all fixed on this branch

1. **Warm-side in-flight image decode** — lazy avatars of the departing list decode and re-raster on top of the sliding layer. Causally proven against CDP presentation: 1 decode = 1 skip (1:1). → unpainted-only image hold extended to warm participants.
2. **Release swallow (desktop-Blink-compiled)** — the clock/first-frame gap of the state-routed release. Observed on glass as "freeze → jump into mid-curve". → the release is atomized with flushSync inside the readiness rAF (a generalization of the WebKit atomic flip; the flip itself stays non-Blink only).
3. **Release race (all drivers)** — a commit wedged between the flip and the state commit re-writes stale hold properties and pauses the running animation for ~250ms. This was the identity of the intermittency ("sometimes it's clean"). → the window is removed entirely by the flushSync unification.
4. **Image-hold double-capture leak** — hold instances of consecutive flights capture each other's display:none as the "original" → loaded avatars permanently blank (130 of 150 reproduced). → attribute-marker-based single-owner guard.
5. **arrivalHold × image-hold cross race** — the in-place freeze reverts the hold's style writes mid-flight (disarming it) and replays them at rest (orphan hiding, ~100/pop). → the freeze excludes the style channel of hold marker elements.
6. **GPU pipeline cold-compile coverage hole** — a fresh profile's first flight carries 120–150ms GPU-channel raster tasks (measured in trace). The existing prewarm did not draw image textures, circular clips, gradients, CJK glyphs, hairlines, or shadow variants. → scene expanded (disappearance confirmed by trace A/B).
7. **Freeze timing thrash** — the browsing rhythm where a push landing's hide overlaps a fast pop's unhide. → ScreenFreeze debounce (3s) skips the freeze itself for fast round trips.

Side note: consumer animation intervention (consumerAnimationPause) was fully
withdrawn by user instruction — flemo does not touch consumer authored state
(standing principle).

## Instrumentation traps (additions to the existing list)

- **mtime-based capture alignment is biased ±300–600ms** — never claim absolute times. Only the differential structure inside a flight is valid. Markers (corner colour inversion) are the only zero-bias sync.
- **VFR recording (screencapture/QuickTime) has ~2.4/s periodic fake gaps** — no gap counting without baseline subtraction (re-confirmed against the Safari control).
- **Display capture is an observer** — the capture client forces WindowServer to composite every vsync and suppresses the symptom itself (confirmed by user-independent observation). A verdict made during capture is a verdict on a mitigated state.
- **Measurement of an offscreen or partially occluded window is contaminated** — because of a coordinate mistake, many "clean" drive measurements had been performed offscreen. Window coordinates must stay within the display width.
- **`evaluate().click()` does not fire pointerdown** — verification that bypasses the entire pointerdown-armed machinery is not verification. Real input is `page.mouse`.
- **Absolute stall comparisons are invalid across different window geometries.**

## Final attribution — the residual "버벅/끊김"

After eliminating all code, profiles, binaries, seeds, caches, storage, and
environment variables, the user's own bisect settled it: **jank when DevTools is
open, clean when closed.** Inspector overhead (request serialization + panel
repaint) loads only the open session, which is consistent with every in-page
instrument reading "clean". The developer lives with DevTools permanently open,
so it recurred in every judging round.

## References

- The do-not-retry additions from this campaign are recorded in [the falsification map](do-not-retry.md).
