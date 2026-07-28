---
"@flemo/core": minor
---

Engine-scoped motion driver: on non-Blink engines the rAF player drives every screen transition on one shared clock; Blink keeps the compiled compositor path. WebKit presents compiled CSS animations from the main thread, so a fetch commit landing mid-flight eats the remaining span and the transition snaps; the player's re-anchoring resumes from the freeze and plays the remainder, delayed but complete.
