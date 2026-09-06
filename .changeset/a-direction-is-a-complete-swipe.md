---
"@flemo/core": minor
"@flemo/react": patch
---

Let a transition declare its swipe as `swipe: { direction, threshold, progress }` instead of writing three hooks, and drive the declared drag as the transition's own pop keyframes scrubbed by the gesture rather than as a style write per frame. This removes the 41 to 49ms of dropped frames every release used to cost, and the flat `swipeDirection` form keeps working unchanged.
