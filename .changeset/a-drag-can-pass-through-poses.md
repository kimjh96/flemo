---
"@flemo/core": minor
---

Let a declared swipe name the poses its drag passes through, as `current`/`prev` stop lists with an `at` between 0 and 1. A drag whose properties reach their values at different points of the gesture no longer has to take over `onMove` and give up the scrub for it.
