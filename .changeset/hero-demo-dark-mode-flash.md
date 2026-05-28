---
"@flemo/web": patch
---

Fix the white flash on the landing page's HeroDemo while the playground iframe is still loading in dark mode. The phone-frame interior and the loading-dot panel now use `var(--color-surface)` instead of a hardcoded `bg-white`, so they track the active theme and the iframe transitions in over a matching backdrop.
