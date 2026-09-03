---
"@flemo/core": patch
---

Compile the transition stylesheet once per registry rather than once per registration. A Router's definitions are usually an array literal, so its registration effect tears down and re-runs on every render, recompiling every keyframe twice for a set that did not change. Profiled on a stack holding several Routers, that was a 237 ms frame on every navigation, growing with each one.
