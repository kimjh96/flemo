---
"@flemo/core": minor
"@flemo/react": patch
---

Protect transitions from image re-decode and reveal-raster jank, whatever assets a consumer uses. A frozen screen's decoded images are discarded by the browser; the anim-hold release now waits (bounded) for the entering screen's images to re-decode, a covered screen entering on pop parks at its destination during the hold so its tiles pre-rasterize (gated on the covering screen's background being opaque, with the paused hold as fallback), and every unfreeze eagerly re-decodes the screen's images so a swipe reveal — which no hold can cover — starts warming immediately.
