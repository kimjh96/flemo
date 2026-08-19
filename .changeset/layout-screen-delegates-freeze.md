---
"@flemo/react-layout": patch
---

`LayoutScreen` now composes `Screen` instead of re-implementing the freeze predicate. The hand-rolled copy froze this package in time: the predicate moved into core, the direct prev screen's freeze became deferred past the convergence (a measured ~0.2 dropped frames per flight), and `flemo:freeze=shallow` became URL-armable — and a `LayoutScreen` consumer received none of it. The transparent background and the `AnimatePresence` wrapper are unchanged.
