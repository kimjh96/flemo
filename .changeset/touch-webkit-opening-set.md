---
"@flemo/core": minor
"@flemo/react": patch
---

Steady the opening and the landing of a transition on iOS Safari. Three changes
ship on by default there, each measured on a device: the hold's release no
longer shares its frame with React's reconcile, the held head carries a hair of
motion so the compositor is already driving the animation when the real motion
starts, and the entering screen's layer is painted during the hold and kept
resident at rest instead of being torn down as the flight lands. Sessions can
opt any of them out with `flemo:relcommit=sync`, `flemo:creep=off` and
`flemo:layers=off`.
