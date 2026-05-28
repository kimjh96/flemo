---
"@flemo/core": patch
---

Compile `contain: layout` and `pointer-events: none` into transitioning variant rules alongside `will-change`. Scoped to `PUSHING` and `REPLACING` only — the verbs that actually trigger a fresh screen mount. Pop is excluded: ScreenFreeze keeps the destination screen mounted so there's no mount work to isolate, and harness measurements showed a small but consistent regression on heavy-DOM exiting screens during pop attributable to containment-block evaluation cost. The hints activate only during the transition window and are released the instant the status flips back to `IDLE`/`COMPLETED`.
