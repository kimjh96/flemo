---
"@flemo/core": minor
"@flemo/react": minor
---

Let a transition declare its swipe as `swipe: { direction, threshold, velocity, progress, current, prev }` instead of writing three hooks, and drive the declared drag as the transition's own pop keyframes scrubbed by the gesture rather than as a style write per frame. This removes the 41 to 49ms of dropped frames every release used to cost, and moves `layout` onto it as well, so no built-in preset drives its own screens any more. The flat `swipeDirection`, `onSwipeStart`, `onSwipe` and `onSwipeEnd` are removed: move them under `swipe` as `direction`, `onStart`, `onMove` and `onEnd`.
