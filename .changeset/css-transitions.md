---
"@flemo/react": minor
---

Switch screen transitions from Motion's JS-driven `animate()` to compiled CSS keyframes. Each registered transition is compiled once at mount into a `<style data-flemo>` tag and applied via `data-flemo-status` / `data-flemo-active` attributes, so push, pop, and replace animations run on the compositor and stop competing with React renders on the main thread. Heavy screens (large trees, Suspense suspends) no longer drop the first frames of their entrance animation. Swipe-back stays imperative: pointer events drive inline `transform`/`opacity` during the drag, then a short inline CSS transition settles the screen and the keyframe pipeline takes over on `history.back()`. Custom transitions keep the same `createTransition({ initial, idle, enter, ... })` shape — the swipe handler signature drops Motion's `PanInfo`/`DragControls` in favor of native `PointerEvent` and a `SwipeInfo` object with the same `offset`/`velocity`/`point`/`delta` fields.
