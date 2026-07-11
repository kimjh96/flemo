---
"@flemo/core": minor
"@flemo/react": patch
---

Pre-rasterize the PUSH-entering screen during the anim-hold ("park-under"): a screen entering from fully off-screen has no rasterized tiles, and Chromium then rasterizes them as the slide reveals — on raster-heavy content that froze a presentation frame mid-motion (a visible "tick"). The entering screen now parks at its destination beneath the previous screen for the hold window (container-level stacking demotion, gated on that screen's verifiably opaque surface, with the paused hold as fallback) and then replays its animation over the already-rasterized layer. Also restores the decode-wait wiring in the React binding — the scope was accidentally dropped in a refactor, shipping the image decode-wait dormant.
