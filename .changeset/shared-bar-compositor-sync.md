---
"@flemo/core": minor
"@flemo/react": minor
---

Compositor-synced shared-bar ride-along. The previous rAF mirror loop read `getComputedStyle(scope)` and wrote inline styles onto the bars every frame — a main-thread roundtrip that left bars trailing the screen by one composited frame, especially visible on mobile. The compiled transition rule now emits a sibling selector targeting `[data-flemo-bar][data-flemo-bar-riding="true"]` with the same `@keyframes` the screen uses, so the bar runs the same animation on the same compositor pass — zero JS in the loop, pixel-exact sync. The rAF path is retained narrowly for swipe-drag, where the screen itself is already main-thread inline-driven and there is no compositor advantage to chase.
