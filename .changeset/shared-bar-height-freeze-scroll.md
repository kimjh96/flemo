---
"@flemo/react": patch
---

Keep the shared app/navigation bar spacer height stable while a screen is frozen (`display: none`) during a transition. The ResizeObserver reports a height of 0 for the frozen screen; using it collapsed the spacer, and WebKit then clamped `scrollTop` to the smaller scroll range without restoring it on unfreeze, so short pages jumped on navigation. The measurement now ignores 0 and holds the last real height.
