---
"@flemo/core": minor
---

Remove the consumer-animation quarantine: the compiled sheet no longer sets `animation: none` on the consumer's own elements and `::before`/`::after` pseudo-elements inside entering screens. Consumer-authored animations (skeleton shimmers, ambient loops) now run exactly as written during transitions.
