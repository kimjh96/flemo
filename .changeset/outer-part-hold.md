---
"@flemo/core": patch
---

Hold `<Part>` elements that live outside any screen for the flight's hold window. The compiled hold rule only pauses held elements and their descendants, so a Part in persistent chrome beside a `<Slot>` (or in a portal) kept animating while every screen was parked, then led the flight by the entire hold — the defect the decorator once had. The engine now stamps the hold on those parts directly, owned by the active side so two screens cannot fight over one persistent element.
