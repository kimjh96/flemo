---
"@flemo/core": minor
"@flemo/devtools": patch
---

Retire the iOS Low Power Mode cadence detection. Its treatment — the compiled tier with the governed head — became the default for every touch-WebKit flight, which left the detection gating nothing: a rAF loop running from module load to the end of the session, six more frames per routed flight and a `sessionStorage` seed, all feeding a flag no code read. `lowPowerCadenceActive` is gone from the public surface; `governedCompiledActive` (the predicate the routing actually asks for) stays. The head gate and its keyframes are renamed to say what they mean — `data-flemo-lpm` is now `data-flemo-governed`, and the `-lpm` animation suffix is `-gov`.
