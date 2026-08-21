---
"@flemo/devtools": patch
---

Stop reporting a healthy flight's closing frames as a stall. The recorder
counted every released frame whose clock and pose stood still, including the
ones after the animations had already finished and the flight was simply
waiting to close — so a "motion stalled ~50ms mid-flight" fired on every single
flight and buried the real ones. Those frames are now counted separately as
`motion.tailFrames`.
