// Layers NO in-page instrument (including this recorder) can observe. Each
// entry exists because a real investigation once burned days re-chasing it
// with in-page tooling. Shipped verbatim in every report so an agent reading
// the data knows where the observable world ends.
export const BLIND_SPOTS: readonly string[] = [
  "macOS Chrome present-pipeline pacing: on 120Hz ProMotion displays Chrome can present frames unevenly even when rAF cadence and this report read perfectly clean (Chromium issues 40062488 / 345275139; proven with a no-script pure-CSS control page that still juddered). Not diagnosable or fixable from page code.",
  "Display-hardware effects: local dimming, backlight modulation, and panel overdrive alter perceived motion and are invisible to every web API.",
  "Compositor-internal present skips: a frame can be produced on time (clean rAF, clean player gaps) yet dropped or delayed inside the compositor's present queue; only platform tools (about:tracing, Instruments) see that layer.",
  "DevTools device emulation composites the page to a rescaled surface: every in-page instrument reads the pre-scale surface and reports clean while the eye watches the post-scale one, so emulated sessions grow shimmer/flash artifacts that do not exist in a plain window or on a real device."
];
