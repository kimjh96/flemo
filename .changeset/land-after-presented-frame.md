---
"@flemo/core": patch
---

Defer a clean transition end's COMPLETED flip by two frames so the last motion frame presents before the convergence commit (status re-renders, freeze, animation strip) lands — removing the dropped frame measured right at landing. Recovery paths still resolve immediately.
