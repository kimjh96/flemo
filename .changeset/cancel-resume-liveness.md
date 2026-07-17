---
"@flemo/core": patch
"@flemo/react": patch
---

Survive browser-cancelled transition animations on every participant: when a mid-transition commit makes WebKit silently cancel a running screen, decorator, bar, or part animation, the engine now resumes it on its original timeline (negative-delay rejoin) instead of losing the exiting screen's fade or cutting the whole transition to a single-frame swap after one retry.
