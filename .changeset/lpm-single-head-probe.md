---
"@flemo/core": patch
---

Add `flemo:lpmhead=single`, an opt-in probe that makes a touch-WebKit flight pay
its flat head once instead of twice. The shipped rule holds the start pose inside
its keyframes and again through `animation-delay`, so a push sits still for 200ms
before it moves; this key removes the second hold for a session so the difference
can be judged on a device. Nothing changes unless the key is set.
