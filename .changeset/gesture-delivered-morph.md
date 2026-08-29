---
"@flemo/core": patch
---

Fix a shared element making its trip twice after a swipe-back. A fast flick lands the gesture's morph before the navigation it commits stages, so the same element was flown again from its original position; the release now tells the navigation what it already delivered instead of leaving it to timing.
