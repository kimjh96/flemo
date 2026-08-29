---
"@flemo/core": patch
"@flemo/react": patch
"@flemo/devtools": patch
---

Keep an entering screen's pre-raster alive across the governed head on iOS
Safari, so a pushed page taller than the viewport no longer slides in blank below
the first tile row and fill in near the end of the transition. Set
`flemo:parkhead=off` to compare against the previous behaviour.
