---
"@flemo/core": patch
---

Widen the clean-end landing deferral from two to four frames so the COMPLETED flip's commit starts after the motion's final frames have cleared the presentation pipeline — measured on WebKit (main-thread presentation), the ~30ms flip commit at write+2 frames still delayed a pop's deceleration tail.
