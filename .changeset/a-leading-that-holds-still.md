---
"@flemo/core": patch
---

Hold a type morph's leading still for the whole flight. A line-height that interpolates smoothly against a face height that climbs in whole-pixel steps is a sawtooth, and it crossed the grid the engine renders leading on three times per flight on desktop Chrome, which read as a tremor with the type nudged down a moment after it landed. The line-height now climbs the same steps the face does, read off the font itself rather than measured with layout, and an engine whose face height is continuous is left exactly as it was.
