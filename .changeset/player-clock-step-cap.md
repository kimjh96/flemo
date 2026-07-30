---
"@flemo/core": patch
---

Cap the player clock's advance at two frames per gap: a 40-100ms main-thread block used to slip under the old 100ms re-anchor cliff and fast-forward the authored curve in one frame (the screen "whooshing" ahead of its easing). Any stall now resumes at most two frames past where it stalled and the curve plays out in full.
