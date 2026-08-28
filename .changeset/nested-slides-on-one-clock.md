---
"@flemo/core": patch
---

Carry a nested pair's from-pose as a relative left/top slide instead of a transform, so its position, size and typesetting all resolve on one clock; WebKit splits a mixed keyframe across its pipelines and the element visibly trembled against itself.
