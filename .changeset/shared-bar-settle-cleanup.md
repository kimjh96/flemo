---
"@flemo/react": patch
---

Extend the active-settle defensive cleanup to this screen's shared bars. The previous patch ([[stale-inline-swipe-styles]]) cleaned `scopeRef` and `decoratorRef` when a screen finished settling as active, but the shared `appBar` / `navigationBar` refs were not in the cleanup set. The swipe-mirror writes inline `transform` / `opacity` / `filter` / etc. to bars in lockstep with the screen, and if any release path is missed (interleaved navigation, a partner whose ride-along path didn't finalize, an unusual transition-driver order) the bar would sit at the swipe-time position even after the owning screen settled as active — same symptom class as the screen bug, just on the bar. Now bars are stripped of their inline styles and `will-change` hint in the same useEffect that handles the screen, so the compiled CSS rest rule cleanly owns the bar at rest.
