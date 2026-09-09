---
"@flemo/core": patch
---

Keep a morph in the air when a swipe is carried the whole way across. The scrub
seeked the flight's animations to `delay + duration`, and `animationend` fires
on that phase change even for a paused animation that never ran, so the flight
landed under a finger that was still down: the shared element blinked home, a
finger coming back the other way moved nothing, and the release ran the whole
morph a second time because there was no longer a flight to mark delivered. The
scrub now stops a tenth of a millisecond short, and the travel's end stays the
release's to reach.
