---
"@flemo/web": patch
---

Rebuild the morph playground as two benches side by side: one asks whether a shared element crosses under any screen transition, the other whether five of them stacked still unwind in order, and both run in the same frame at the same size so what they show can be compared. Each bench names its own variables — the screen transition, the morph preset, and what to watch — so the `sheet`/`zoom` pair reads as the one-variable A/B it is. The fixture's screens now take the site's theme, which they never did: every screen inside the frames painted white, so the whole playground was unreadable in dark mode.
