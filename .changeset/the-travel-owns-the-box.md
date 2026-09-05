---
"@flemo/core": patch
---

Stop stating a travelling element's box twice. Staging wrote an inline `width` and `height` that the travel keyframe also animates, which is the same value from two cascade levels for no benefit. The keyframe states the box for every frame of the flight, so it is now the only thing that does.
