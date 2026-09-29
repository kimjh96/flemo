---
"@flemo/core": patch
---

Give a Morph's travelling element its own compositing layer on Chromium. Painted into its container, a flight's text moved on whole device pixels, so the slow end of every Morph stepped a pixel every few frames and read as trembling at the convergence; it now glides fractionally like the screen transitions do.
