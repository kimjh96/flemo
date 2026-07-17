---
"@flemo/react": patch
---

Fix `<Part>` to read its status from the Router that owns its screen. A Part placed in a nested Router's chrome previously followed the inner Router's transitions instead of its enclosing screen's, so it never animated with the outer navigation.
