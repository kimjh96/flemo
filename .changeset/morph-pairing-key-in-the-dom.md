---
"@flemo/core": minor
---

Write a morph's pairing key into the DOM as `data-flemo-morph-id`, and export
the morph attribute names (`MORPH_ID_ATTR`, `MORPH_CAMERA_ATTR`,
`MORPH_GHOST_ATTR`, `MORPH_STAND_IN_ATTR`) alongside the ones already public.
A shared element that fails to pair produces no error, no attribute and no
animation, so the single most common morph failure was invisible to everything
outside the runtime; with the key on the element an inspector or
`@flemo/devtools` can group the two ends itself and report a pair that never
flew. Copies the runtime makes (the stand-in and the ghost) drop the key with
the rest of their identity.

The transition name and the pairing key are written only when they change. A
morph is re-registered on every status change, and an attribute write
invalidates that element's style: the unconditional write was one invalidation
per morph per navigation, on the same bench where exactly that cost was
device-measured as judder.
