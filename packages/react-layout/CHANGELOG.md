# @flemo/react-layout

## 0.1.0

### Minor Changes

- [`819fa1f`](https://github.com/kimjh96/flemo/commit/819fa1f0ee75ff1540b79b811ff6953eeff3bc20) - Initial release of `@flemo/react-layout` — `LayoutScreen` + `LayoutConfig` for shared-element morphs via `layoutId`. Moved out of `@flemo/react` so apps that don't use layoutId no longer carry the motion peer dependency. Install when you want a list item to morph into its detail view: `pnpm add @flemo/react-layout motion`. The components themselves are unchanged; only the import path moves: `import { LayoutScreen, LayoutConfig } from "@flemo/react-layout"`. Phase 3 will eventually replace motion with a native FLIP implementation here, dropping the motion peer dep entirely.

### Patch Changes

- Updated dependencies [[`1aef7de`](https://github.com/kimjh96/flemo/commit/1aef7de948d0a9edce6b48419558e468226c9eb4), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335), [`3a727cb`](https://github.com/kimjh96/flemo/commit/3a727cb2bf589147a1a7759a7a1f9e99b28d7926), [`58c930b`](https://github.com/kimjh96/flemo/commit/58c930bfcd30874f072d2567d255d2e283fe08f6), [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58)]:
  - @flemo/react@1.0.0
  - @flemo/core@1.0.0
