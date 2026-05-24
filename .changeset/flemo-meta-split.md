---
"flemo": patch
---

Internal restructure: `flemo` is now a thin meta package that re-exports `@flemo/react` (which itself depends on `@flemo/core`). The public surface is unchanged — every existing import from `flemo` keeps working. Users who want a lighter dependency can install `@flemo/core` or `@flemo/react` directly. `LayoutScreen` and `LayoutConfig` remain accessible from `flemo` for now; a future major will move them to `@flemo/layout` so consumers that don't use layoutId can drop the Motion peer dependency.
