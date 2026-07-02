---
"@flemo/core": minor
"@flemo/react": patch
---

Fix a shared bar riding a frame behind its screen on browser-back navigation. `data-flemo-bar-riding` is now computed in render and committed alongside the bar's status, so the bar starts its keyframe in the same frame as the screen for any transition and any trigger (a programmatic `pop` or the browser back button). The internal `driveBarRiding` engine helper is replaced by the pure `computeBarRiding`.
