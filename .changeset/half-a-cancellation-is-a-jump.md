---
"@flemo/core": patch
---

Only carry a type morph's ascent backwards where there is a box to carry it on. A nested pair riding its container has no box channel, so the transform that takes the ascent off was emitted with nothing to send the box up by the same amount, and the line started an ascent too high. Reported from the poster grid as a title jumping twelve pixels up at the first frame.
