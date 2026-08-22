---
"@flemo/core": patch
---

Stop a back-swipe from catching once at its start. The screen a swipe reveals is normally frozen, and starting the gesture is what wakes it — a commit over that whole screen that used to land on the drag's first frames. The motion now waits for the reveal to be painted and then resumes from where the finger is, so the opening is a frame or two later and nothing stutters after it. A gesture with nothing to wake is unaffected.
