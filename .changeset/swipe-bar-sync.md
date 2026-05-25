---
"@flemo/react": patch
---

Eliminate the one-frame lag between a screen and its riding shared bars during user-driven swipe drag. The previous swipe mirror was a `requestAnimationFrame` loop that read `getComputedStyle(scope)` and wrote the value back to each bar — but rAF runs in its own JS tick separate from the `pointermove` handler that just wrote the screen, so the bar's commit always landed in the next paint pass. On mobile and slower devices this trailed visibly even though push / pop transitions (compositor-driven via the keyframe sibling selector) were already pixel-perfect.

The mirror is now synchronous. `animateInline` is wrapped at the swipe lifecycle boundary (`beginSwipe` / `continueSwipe` / `endSwipe`) and intercepts every write to `currentScreen` or `prevScreen`, mirroring it to whichever bars ride that screen in the SAME JS tick. There is no rAF, no `getComputedStyle` read, no second pass — the browser composites the screen and the bars in one paint commit.

Two ride lists are captured at `beginSwipe`: the current screen's bars (mirrored when the swipe handler writes to `currentScreen`), and the previous screen's bars (mirrored when it writes to `prevScreen` — both cupertino and material drive both screens per swipe tick). The previous-side bars are found by querying the partner screen container directly, so the swipe-driver doesn't need to reach into the partner ScreenMotion instance. Without this two-list split, an app whose previous screen owns a shared bar the current screen doesn't (e.g., a tab bar on the home screen, hidden on a detail screen) would see that bar fail to follow the swipe at all.

The `will-change` hint moves to swipe-start so the riding bars pre-promote to their own compositing layer before the first inline write, and is cleared on swipe-end (or on commit, before `history.back()`, so the layer can be discarded cleanly). On commit, the previous-side bars are also stripped of any inline styles the swipe wrote — those would otherwise shadow the compiled CSS rest rule when the previous screen settles as active.
