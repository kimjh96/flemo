---
"@flemo/react": major
"@flemo/core": minor
---

Add `<Layer>`, and confine a screen's own content to the screen.

A screen that is moving carries a transform, which makes it a containing block for `position: fixed` descendants and a stacking context around all of them. An overlay authored inside a screen therefore travels with it and cannot paint above the shared bars, which live outside — no z-index inside the screen can reach past them. `<Layer>` portals its children to a host beside the screen, after the bars, where they anchor to the viewport, cover the bars, and still belong to that screen.

Layout containment moves from the screen container to the screen itself, so a screen's content stays inside the screen at rest as well as in flight. **This is the breaking part**: a `position: fixed` overlay written inside a screen no longer escapes it. Wrap those in `<Layer>` — usually once, inside the sheet or dialog primitive that every call site already goes through.
