---
"@flemo/core": patch
---

Keep a morph flying when its animation is rebuilt mid-flight. A CSS animation that is torn down and replaced reports an `animationend` with no elapsed time — same name, same keyframes, same duration — and landing on that put the shared element back in its screen before it had moved, so the morph looked skipped while the screen transition ran on. The landing now waits for an end that actually ran.
