---
"@flemo/core": patch
---

Derive every transition deadline from the authored choreography instead of fixed constants: the task gate's ~1.2s backstop silently cut any longer authored transition mid-flight, and the choreography deferral's 1s cap cut any part authored more than a second past its screen. The gate, the liveness floor, and the deferral now all scale with the full choreography span (active, passive, and parts alike) plus the recovery margin — an authored duration of any length plays in full, and the backstops only ever fire on a genuinely stranded task.
