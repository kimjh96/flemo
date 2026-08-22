---
"@flemo/core": minor
"@flemo/react": patch
---

Add `startFlemoRuntime()` — flemo's ambient machinery behind one call. The GPU
pipeline prewarm, the image-decode offload and the interaction compositor warm-up
are what an app sits in so the first navigation is not the one that pays for them,
and none of it is framework-specific. A binding starts the runtime per Router mount
and releases on unmount; repeat calls share one runtime.

`@flemo/react` loses 58 lines and its last document event wiring. Nested Routers now
share one listener set instead of installing their own.
