---
"@flemo/core": patch
---

Arm the render-settle gate by default on desktop macOS Safari. That session runs
the compiled tier, which WebKit presents from the main thread, so a heavy entering
screen's mount used to age the animation's clock while nothing was on glass — the
transition appeared to start already two-thirds finished and then replay from the
top. The gate now holds the release until the mount settles, so the opening plays
in full.
