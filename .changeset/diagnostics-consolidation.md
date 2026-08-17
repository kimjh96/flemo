---
"@flemo/core": patch
"@flemo/react": patch
---

Remove dead diagnostic instrumentation (the write-only `window.__flemoRoute`/`__flemoOpenings`/`__flemoSeam`/`__flemoHandoffs`/`__flemoParked` globals and the unused `flemo:compiled` and `flemo:native` toggles) and consolidate the surviving `flemo:*` debug flags into one documented registry (`diagnosticFlags.ts`). No behavior change — every shipped default, storage key, and per-page-load caching contract is preserved, and `window.__flemoPlayerGaps` keeps working.
