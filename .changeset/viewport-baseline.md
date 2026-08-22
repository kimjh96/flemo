---
"@flemo/core": patch
---

Fix `changedViewportScrollHeight` reporting only the first keyboard opening. The baseline was the first non-zero measurement, so it became the open keyboard's own shortfall; it is now the smallest shortfall seen, which the page reaches whenever the keyboard is closed.
