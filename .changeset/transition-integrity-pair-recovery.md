---
"@flemo/core": minor
"@flemo/react": patch
---

Pair-release the anim-hold for every navigation (push and replace included, not just pop), scope the image-decode wait to screens actually waking from a freeze so the pairing costs nothing, and teach the transition engine to recover a cancelled screen animation (restart once, then a duration-based watchdog) instead of hanging until the 1.2s task gate and snapping with no transition.
