---
"@flemo/react-layout": minor
---

Deprecate this package: it is superseded by `<Morph>` in `@flemo/react`, which needs no `motion` peer dependency. `LayoutScreen` becomes a plain `Screen` (flemo now keeps a screen carrying a travelling element from painting over its partner by itself), `LayoutConfig` has nothing left to align because a morph already runs on the screen transition's timing, and every `motion.* layoutId` becomes `<Morph layoutId>`. This release only adds the notice; the package is removed next.
