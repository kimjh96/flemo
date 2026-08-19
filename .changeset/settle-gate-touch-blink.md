---
"@flemo/core": patch
---

Default the render-settle entry gate ON for touch Blink. The pop-convergence round proved on a Note 9 that a heavy mount commit stalls even the compositor's initial layerization — gating the release past that task measurably helped — and widened the gate's arming to every engine on that evidence, but the flag that enables it stayed WebKit-only, so Android kept running ungated. The gate stays adaptive (no qualifying mount commit inside the first wait releases with no felt delay), and `flemo:settle-gate=off` still opts out.
