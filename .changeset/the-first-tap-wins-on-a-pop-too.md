---
"@flemo/core": patch
---

Ignore a pop that lands while a transition is in flight, the same first-tap-wins guard push and replace always had. A back tapped during a pop used to queue behind the running flight and run against a half-cleaned stack, cutting a zoomed pop to rest with no camera and no text morphs.
