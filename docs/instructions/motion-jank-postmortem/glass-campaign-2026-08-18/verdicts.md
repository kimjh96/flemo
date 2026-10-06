# Verdict protocol, recorder artifact, and final attribution

## Binding verdict protocol

- Judge transition quality with DevTools closed, without capture, using real input.
- Any single-frame-level verdict from `screencapture -v` is void.

## Recorder artifact

- `screencapture -v` (VFR, window or display) injects a metronomic approximately 1-frame “drop” every approximately 400ms. During continuous motion it appears as a 33ms pts gap, indistinguishable from a real dropped frame. Parity proved the artifact: the identical periodic pattern appeared in Chromium, Playwright-WebKit, REAL Safari (the user's smooth reference), and a zero-JS pure-CSS compositor slide.
- Playwright's WebKit port is not a Safari smoothness proxy: it measured worse than Chromium on the same harness.
- On macOS Spaces, display-mode `screencapture -v` records the ACTIVE space. A fullscreen IDE puts the driven browser off-glass, possibly throttled. Window-id mode (`-v -l<id>`) captures across spaces but retains the VFR artifact. AVFoundation CFR capture also sees only the active space.
- After governor removal, rest-side arrival release, and pre-raster rounds, Chromium pristine-compiled == real Safari == pure-CSS control at every layer measurable in-machine. Deeper measurement requires visible-space CFR capture, with the space on glass, or an external camera.

## Final attribution of residual stutter (“버벅/끊김”)

After eliminating code, profiles, binaries, seeds, caches, storage, and environment variables, the user's own bisect found jank with DevTools open and clean motion with it closed. Inspector overhead (request serialization and panel repaint) loads only the open session, consistent with every in-page instrument reading “clean.” The developer kept DevTools permanently open, so the symptom recurred in every judging round.
