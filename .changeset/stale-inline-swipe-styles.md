---
"@flemo/react": patch
---

Two-layer fix for stale inline swipe styles surviving a navigation cycle and resurfacing on a later visit. flemo keeps inactive screens mounted via `display: none` (`ScreenFreeze`), so any inline `transform` / `opacity` / `filter` / `backgroundColor` / etc. that a swipe handler wrote via `animateInline` outlives the original navigation. Because inline styles beat the compiled CSS rest rule (`animation-fill-mode: forwards`), the screen renders at the stale "previous-screen waiting" position when it next becomes active.

First layer — make `clearInlineAnimation` actually clean what `animateInline` wrote: a per-element WeakMap tracks every property animateInline sets, and the default-branch cleanup now strips exactly that surface. Previously it only removed `transform` + `opacity`, leaking any other animated property (e.g., `filter` on a custom blur transition). Untracked elements still fall back to the transform + opacity pair for defensive behavior.

Second layer — defensive cleanup in `ScreenMotion`: every time a screen settles as the active topmost screen (`status === "COMPLETED"`), strip leftover inline animation styles and the `data-flemo-skip-animation` marker on the scope and decorator. This catches stale state from any path — the swipe-commit branch (which intentionally leaves the screen at its final inline position), interleaved navigation mid-cancel, custom transitions, decorators, anything — without needing each path to remember to clean up.
