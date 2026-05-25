---
"@flemo/core": patch
---

Stop appending `px` to CSS custom property values during transition compilation. `{ "--space": 16 }` now compiles to `--space: 16;` instead of `--space: 16px;`. Custom properties are typeless — flemo can't know whether the author intends pixels, a count, a ratio, or a multiplier — so the safe default is to pass the raw scalar through and let the call site shape the unit (e.g., `calc(var(--space) * 1px)` in CSS). Mirrors React's `name.startsWith("--")` short-circuit in inline-style coercion.
