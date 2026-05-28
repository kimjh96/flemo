---
"@flemo/core": patch
---

Align the `overlay` decorator's `enter` / `exit` duration and easing to cupertino's push / pop slides (0.7s / 0.6s, cubic-bezier(0.32, 0.72, 0, 1)). The keyframe now reaches its `to` value exactly when the screen status flips to COMPLETED, eliminating the `fill: both` hold sub-window where the rest-rule handoff could race against the compositor. Swipe handler durations stay at 0.3s so the gesture release remains responsive.
