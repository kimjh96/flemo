---
"@flemo/core": patch
---

Hand a swipe's morph and riders back by placing their start time rather than calling `play()`. A pending play resumed at a time each engine resolved differently, so on WebKit the shared element froze at the pose the finger let go of while the screens slid out from under it, then jumped to the arrival in one frame.
