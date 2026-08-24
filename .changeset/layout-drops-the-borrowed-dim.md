---
"@flemo/core": patch
---

Stop the `layout` transition wearing a dim on someone else's clock. It named the built-in `overlay` decorator, which is compiled once per decorator NAME with the durations its author wrote — 0.7s, sized for cupertino's 0.7s flight. `layout` runs 0.4s, so on a pop the dismissing screen was gone at 335ms while the screen underneath kept a 10% black wash for another 300ms: a grey cast appearing from nowhere and lifting for no reason, over a screen that is holding still so a shared element can be followed across it.
