---
"@flemo/core": patch
---

Hold the content-settle gate through React's suspense reveal throttle, keyed on state rather than timing: while the entering screen is still an animated skeleton (shimmering placeholders, nothing fetching, nothing mutating) the gate keeps waiting for the reveal commit, bounded only by the settle cap, and the anim-hold backstops now outlast that cap instead of firing underneath it. A de-shelled scope with nothing pending then releases on a two-frame anchor, so the reveal lands before the motion starts without paying the full quiet window.
