---
"@flemo/core": minor
"@flemo/web": patch
---

Fix the pop-convergence round: post-landing layer demotions now wait out any
in-flight navigation (the intermittent mid-pop stall), the player's
perceptual cut lands its final pixel on the cut frame instead of the
COMPLETED flip, and a navigation force-concludes swipe settles on its
participants — a tap grazing the swipe-back edge no longer fights the pop it
triggered. Desktop WebKit and desktop Blink now ride the compositor-driven
compiled tier deterministically, with the landing governor expressed as an
easing reshape. The image decode offloader holds re-entry reveals to the
flight's rest, and the playground's baked gradient is scoped to Blink (the
swap itself was Safari's first-entry blink).
