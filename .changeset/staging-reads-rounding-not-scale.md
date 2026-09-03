---
"@flemo/core": patch
---

Stop reading a fractional layer layout as a scale. `offsetWidth` is rounded and the painted box is not, so a stage sized by `aspect-ratio` against a viewport that is not a round number inflated every staged rect by up to half a pixel, and the flight stepped that far at the landing.
