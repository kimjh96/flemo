---
"@flemo/core": patch
---

Move the per-screen holds — the compositor warm-up, the in-flight arrival armor and the
warm side's image hold — into their own module, and pin the engine's "never a double
resolution" invariant with a test rather than by splitting the six resolution paths
apart. No behavior change.
