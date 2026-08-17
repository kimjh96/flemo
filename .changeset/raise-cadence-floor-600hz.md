---
"@flemo/core": patch
---

Raise the player's learned frame-interval floor from 240Hz to 600Hz so its cadence estimate can track the fastest panels now shipping (consumer esports monitors reach ~540-600Hz). The old floor clamped a genuine high-refresh desktop down to 240Hz, leaving the pacing heuristics (jitter thresholds, pixel-snap budgets) calibrated for a slower display than the panel really is. The estimate is a median, so widening the floor doesn't reopen the jitter-fakes-a-fast-panel hole the floor guards against.
