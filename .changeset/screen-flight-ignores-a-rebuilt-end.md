---
"@flemo/core": patch
---

Keep a screen transition running when its animation is rebuilt mid-flight. A CSS animation that is torn down and replaced reports an `animationend` with no elapsed time, carrying the same name, keyframes and duration as a real one, and the engine resolved the navigation on it: the store move committed and the screen flipped to COMPLETED while the motion was still at its from-pose, so what reached the glass was a cut where a transition was authored. The flight now waits for an end that actually ran, and a variant with no motion of its own still lands immediately.
