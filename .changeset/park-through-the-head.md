---
"@flemo/core": patch
"@flemo/react": patch
"@flemo/devtools": patch
---

Keep a screen's pre-raster alive across the head that follows it, so a pushed
page taller than the viewport no longer slides in blank below the first tile row
and fill in near the end of the transition on iOS Safari. Applies wherever the
engine parks a screen — every authored transition, however it hides one, on both
the entering and the covered side. Set `flemo:parkhead=off` to compare against
the previous behaviour.
