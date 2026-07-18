---
"@flemo/core": patch
---

Make the compiled compositor animation the default screen-transition driver on every engine, with no automatic or mid-flight driver switching. Per-frame screencast diffing on real Chrome showed the rAF player's px-snapped writes shiver at the deceleration tail (hold/1px-step alternation) while translate3d-compiled keyframes decay monotonically to rest — the Blink judder the player was built to route around no longer exists — and under CPU throttle the compositor plays every fade on time while a main-thread player collapses. The player remains available behind the `flemo:motion-driver-force` pin for diagnostics.
