---
"@flemo/core": patch
---

Split the transition engine into named modules. `createTransitionEngine` was a
2,138-line file holding participant discovery, compositor-layer leases, cancel-resume
wiring, the display probe and the per-flight routing decision alongside the lifecycle
it exists for. Those are now five modules with their own tests; the engine keeps the
navigation-task lifecycle, the holds and the resolution. No behavior change.
