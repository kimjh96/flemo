---
"@flemo/core": patch
---

Resolve the covered screen's decorator at every use instead of once at the start of a swipe, so a dim that the drag's own wake re-mounts into the layer host still follows the finger and still settles. A screen frozen while holding a `<Layer>` overlay used to hand the gesture a handle that left the document a frame later, which left the dim at its full rest value for the whole drag and the whole landing before it cut to zero in one frame.
