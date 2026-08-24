---
"@flemo/core": patch
---

Keep a morph honest about what it carries. An element whose destination fills its screen (`min-height: 100%` and friends) now actually grows during the flight instead of being pinned at full size by the clamp from the first frame, and any animation a consumer put INSIDE a morph — a `<Part>`, a spinner, a fade of their own — keeps its clock across the flight instead of replaying from the top the moment the element lands. The ghost no longer carries part markers, so no entrance runs a second time inside an afterimage.
