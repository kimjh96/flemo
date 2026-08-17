---
"@flemo/core": patch
---

Stop the `driver=raf` force-pin from routing desktop Blink onto the rAF player. The player has never driven a non-touch flight; device-reproduced, after a re-entry (push→pop→push) it leaves the entering screen pinned at its from-pose (`translateX(100%)`) — the birth/play never fires — so the screen sits entirely off-screen and the viewport goes blank. Desktop Blink stays on the compiled compositor tier, which completes cleanly.
