---
"@flemo/web": patch
---

Update the API reference table so the `createDecorator` row reflects the four-slot signature (`initial / idle / enter / exit`). The previous "six-phase" label was already a copy-paste from `createTransition` and is doubly stale now that `createDecorator` requires `idle`.
