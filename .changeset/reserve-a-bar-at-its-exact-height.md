---
"@flemo/core": minor
"@flemo/react": patch
---

Reserve a shared bar's space at its exact fractional height from the first measurement. The first reading was rounded to a whole pixel and corrected after the navigation landed, which moved the screen's content by half a pixel and flickered a line at its bottom edge after every tab switch. Adds `readBarHeight` to `@flemo/core`.
