---
"@flemo/core": minor
"@flemo/react": patch
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
swap itself was Safari's first-entry blink). On iOS, Low Power Mode is now
detected (a regular ~33ms rAF cluster, isolated from the player's learned
interval, persisted per session) and single slide navigations route to the
compositor-driven compiled tier with the birth anchor and stall watcher
armed — rAF is capped at ~30Hz under LPM while the compositor keeps the
panel rate, so transitions stay smooth instead of half-density.
