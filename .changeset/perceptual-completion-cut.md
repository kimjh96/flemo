---
"@flemo/core": patch
---

End a transition the moment its remaining motion drops below one device pixel (and one opacity step) on every animated channel, computed analytically from the easing curve. The asymptotic tail of a deceleration curve spends 150ms+ moving sub-pixel distances, which presents nothing but forces per-frame text re-rasterization at shifting anti-aliasing phases — visible as a fine shimmer at the convergence on scaled display pipelines. The cut presents pixels identical to the authored motion, includes every participating `<Part>`'s registered timing in its ceiling, stays inside the natural animation span, and yields to the recovery machinery (cancel-resume, watchdog) whenever the clock shifts.
