---
"@flemo/react": patch
---

Fix transitions skipping ahead on WebKit when a screen's content updates mid-transition (e.g. an async fetch resolving). The content is now isolated onto its own compositing layer while a transition is in flight, so the repaint no longer stalls the animating layer's presentation. Applies to every transition, including custom ones.
