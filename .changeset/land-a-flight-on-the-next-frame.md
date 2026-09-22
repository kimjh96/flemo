---
"@flemo/core": patch
---

Wait only as many frames before the completion flip as the engine needs to present the motion's last one. Blink draws that frame from the compositor, so one frame covers it; the four every engine was waiting held the picture still for 50ms and then repainted it, which read as a hitch at the end of every pop. WebKit keeps the four its main-thread presentation was measured to need.
