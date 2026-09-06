---
"@flemo/core": major
---

Remove the compositor warm-up. A hidden element animated `background-position`, a
property the compositor cannot take, on an infinite loop, so every frame of a flight
and every frame for three seconds after any pointer movement forced a main-thread
repaint. It was kept because it was believed to buy back a lost opening frame.

A same-build A/B could not find that frame. Across cold navigations (five seconds
untouched first) and warm ones, on real desktop Chrome driving the same deployment
with only this machinery switched off, dropped frames were 10 of 1095 with it and 11
of 1103 without, and late animation frames were 1 against 1. What it did cost is
measurable: 1303 style recalculations per ten seconds of mouse movement with no
navigation at all, against 1 without it, and 193 against 95 per transition. Its
founding measurement was taken under DevTools mobile emulation, which the engine
itself warns is a source of phantom motion.

`holdCompositorWarm()` and `WARM_ATTR` are no longer exported, and the
`data-flemo-warm` element no longer exists. Delete any selector that targets it.
