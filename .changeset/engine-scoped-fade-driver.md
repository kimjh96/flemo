---
"@flemo/core": minor
---

Drive low-displacement motion (tab fades, drifts) with the rAF player on non-Blink engines. WebKit presents compiled CSS fades from the main thread, so a fetch commit landing inside the fade eats its remaining span and the transition snaps to its end; the player's re-anchoring resumes from the freeze and plays the remainder — delayed but complete. Real slides keep the compiled compositor path on every engine.
