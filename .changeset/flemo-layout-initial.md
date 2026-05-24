---
"@flemo/layout": minor
---

Initial release of `@flemo/layout` — `LayoutScreen` + `LayoutConfig` for shared-element morphs via `layoutId`. Moved out of `@flemo/react` so apps that don't use layoutId no longer carry the motion peer dependency. Install when you want a list item to morph into its detail view: `pnpm add @flemo/layout motion`. The components themselves are unchanged; only the import path moves: `import { LayoutScreen, LayoutConfig } from "@flemo/layout"`. Phase 3 will eventually replace motion with a native FLIP implementation here, dropping the motion peer dep entirely.
