---
"@flemo/react": patch
---

Eliminate the one-frame lag between the screen and its riding shared bars during user-driven swipe drag. The previous swipe-mirror was a `requestAnimationFrame` loop that read `getComputedStyle(scope)` and wrote the value back to each bar — but rAF runs in its own JS tick separate from the `pointermove` handler that just wrote the screen, so the bar's commit always landed in the next paint pass. On mobile and slower devices this trailed visibly even though push/pop transitions (compositor-driven via the keyframe sibling selector) were already pixel-perfect.

The mirror is now synchronous. `animateInline` is wrapped at the swipe lifecycle boundary (`beginSwipe` / `continueSwipe` / `endSwipe`) so any write to `currentScreen` also writes to the riding bars in the SAME JS tick. There is no rAF, no `getComputedStyle` read, no second pass — the browser composites the screen and the bars in one paint commit. Bars riding from `onSwipeStart` through `onSwipeEnd` (both the cancel and the commit branches) all stay in lockstep with the screen.

The `will-change` hint is moved to swipe-start so the riding bars are pre-promoted to their own compositing layer before the first inline write, and cleared on swipe-end (or on commit, before `history.back()` so the layer can be discarded cleanly).
