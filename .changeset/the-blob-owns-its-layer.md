---
"@flemo/web": patch
---

Keep the playground stage's and the hero's gradient blob on its own compositing layer. WebKit re-rastered its 64px blur at the first and last frame of every flight inside the bezel, which stalled a pop's start and landing by 50 to 90ms on a Retina display.
