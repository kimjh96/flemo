---
"@flemo/core": minor
---

A replace arriving mid-transition now supersedes the in-flight transition (fast-forwards it and starts immediately) instead of being silently dropped. Rapid bottom-tab switching no longer swallows taps that land inside the previous tab's flight, and lag no longer accumulates behind queued fades.
