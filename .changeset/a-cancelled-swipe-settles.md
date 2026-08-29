---
"@flemo/core": patch
---

Settle a swipe the browser cancels instead of teleporting it. A `pointercancel` or a lost pointer capture used to snap the screen from wherever the finger left it back to rest in a single frame, because a forced cancel was treated as a tap and the neutral sample that stops it committing was also handed to the release clock, leaving it no distance to travel. The screen now walks home over a real reversal, while a genuine sub-slop tap stays instantaneous and a cancel still cannot commit a navigation.
