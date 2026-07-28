---
"@flemo/react": patch
---

Defer the covered screen's freeze commit 600ms past the convergence instead of applying it at the COMPLETED flip. The freeze disconnects the covered screen's whole effect tree in one large commit; landing it while the eye watches the transition settle was measured (paired on-device A/B) as the remaining convergence frame drops. The screen is already covered, so freezing late is invisible; a new transition re-arms the timer so the commit only lands in a quiet window. Unfreezing stays immediate.
