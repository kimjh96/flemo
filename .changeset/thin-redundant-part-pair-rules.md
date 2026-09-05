---
"@flemo/core": patch
---

Stop emitting a compiled rule for every transition-and-part pair whose clock is the one the part's by-name rule already carries. A part that authors its own duration resolves to the same clock under every transition, so its per-transition twin only inflated the stylesheet the browser re-matches on each navigation. The reference playground's sheet drops from 2049 style rules to 531 with no change in behavior.
