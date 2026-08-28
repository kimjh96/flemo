---
"@flemo/web": minor
---

Add two consumer-authored transitions to the playground bench, so it carries the four presets the library ships plus three written on the page. `drift` is depth rather than direction: the arriving screen comes forward while the covered one recedes and never touches its own opacity, so nothing double-exposes under the shared element. It names `recess`, a decorator authored beside it and sized to its own two durations rather than borrowing the 0.7s `overlay` that exists for `cupertino`. `fade-through` sequences its two fades with `delay` so the leaving screen reaches zero exactly as the arriving one starts, and the shared element carries the eye across the instant neither screen is drawn.
