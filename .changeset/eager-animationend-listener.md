---
"@flemo/react": patch
---

Move `ScreenMotion`'s transition-lifecycle `animationend` listener (and the COMPLETED-branch inline-style cleanup) from `useEffect` to `useLayoutEffect`. The listener now attaches synchronously during commit, before the browser paints the first animation frame, closing a tiny race where a very short variant could finish before a post-commit `useEffect` attached. The pre-paint cleanup also means the browser never paints a transient frame with stale inline styles overlapping the rest CSS rule. Measurable cost in the production-ship configuration (with the compositor isolation hints active) is zero.
