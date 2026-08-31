---
"@flemo/core": patch
---

Stop the compositor warm-up from being visible. Its element drops from 0.02 to
0.006 opacity after a consumer reported seeing the 48x48 patch on an iPhone in
the moment before a transition, and it is now session-resident so a tap no
longer pops it in and out on the navigating path. The steady-60 desktop cadence
video is removed outright.
