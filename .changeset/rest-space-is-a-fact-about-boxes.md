---
"@flemo/core": patch
---

Measure a flight in rest space by taking every ancestor pose back off the rect. A transition puts its from-pose on whatever its selector names, and a morph was undoing only a screen's, and only when the Router matched: a shared bar sitting inside another Router's screen had its arrival measured with the transition's shift still on it and never taken off, so the flight was placed a whole shift out and snapped back at the landing. Displacement is a property of the boxes above an element, not of any Router, so it is now read from the boxes.
