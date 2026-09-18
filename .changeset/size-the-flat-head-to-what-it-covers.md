---
"@flemo/core": patch
---

Wear a desktop Chromium flat head only while there is a latency for it to cover. A head holds the from-pose across the gap between a compiled clock's birth and its first frame reaching the glass, and a cover for a gap that is not there is dead time. The session now measures its own release-to-first-frame per navigation status and takes the head only while that runs longer than a frame, so an app whose screens are already mounted pays nothing.
