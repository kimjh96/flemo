---
"@flemo/core": patch
---

Retire the LPM release-latency ledger. The probe armed on every low-power-supervised flight and persisted a session-worst value to `flemo:lat`, but no production code ever read it — the birth hold is sized from a static table, so the "adaptive" hold was always the static guess. Removing it drops an observer per flight on the weakest devices in the matrix and one more persisted ledger that can go stale between builds.
