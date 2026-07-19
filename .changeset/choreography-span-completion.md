---
"@flemo/core": patch
---

Complete a navigation when its whole choreography completes: a passive side or `<Part>` whose registered motion outlives the active screen's animation was truncated mid-flight by the COMPLETED flip at the active animationend (visible as the part snapping right at the convergence). A clean end now defers the task resolution by the difference, bounded, so the full choreography plays; the perceptual cut composes with it (a part resolves at its own sub-perceptual point).
