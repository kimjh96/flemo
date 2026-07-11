---
"@flemo/core": minor
"@flemo/web": patch
---

Extend the rAF player to EVERY motion a transition can declare. Values the numeric interpolator cannot pair (clip-path morphs across templates, calc() expressions, mixed units, one-sided properties) are now driven by a scrubbed Web Animation: created paused, its currentTime stepped every frame from the same shared clock, so the browser interpolates with exact CSS semantics while the progression stays main-thread-driven — the same compositor-jank immunity as the numeric tier, for built-in and user-authored transitions alike. The compiled CSS path remains only for replay chains, policy-demoted devices, and environments without WAAPI. The playground gains a "Wipe" transition whose mismatched clip-path templates exercise this tier end-to-end.
