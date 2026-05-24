---
"@flemo/core": patch
---

`findScrollable` correctness + side-effect fixes that show up on every swipe-back pointerdown:

- `canProgrammaticallyScroll` no longer mutates the candidate's `scrollTop` / `scrollLeft` to probe scrollability. It now reads `overflowX` / `overflowY` from computed style instead — same intent (does this element actually scroll on this axis?) without firing scroll events or interfering with `scroll-snap` / `scroll-behavior: smooth` consumers.
- The ancestor walk no longer stops at `document.body`, so viewport-level scrolling on `<html>` (`documentElement`) — the default for many apps — is now detected as a scroll boundary and gates swipe-back correctly.
- `getStartElement` now returns `null` instead of force-casting non-Element event targets (`document`, `window`, `Text`) to `HTMLElement`, avoiding a downstream crash in the parent-walk loop.
