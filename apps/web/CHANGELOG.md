# @flemo/web

## 0.2.0

### Minor Changes

- [`f7ff70b`](https://github.com/kimjh96/flemo/commit/f7ff70bd3b5a09a9204b73c523e6e457d2886ef9) Thanks [@kimjh96](https://github.com/kimjh96)! - Split the `LayoutScreen` section out of the Screen page into a dedicated docs entry with a deeper walkthrough — when to reach for it, the four-piece mental model (`transitionName: "layout"`, `layoutId`, `<LayoutConfig>`, `<LayoutScreen>`), why each piece exists, common patterns, expanded pitfalls, and when to skip morphing entirely.

- [`f834d4d`](https://github.com/kimjh96/flemo/commit/f834d4dae3088dd01c8385609987268aad99b03f) Thanks [@kimjh96](https://github.com/kimjh96)! - Rebuild the playground from scratch around a minimal music-player demo: Library / Search tabs with a shared mini-player + tab-bar (`sharedNavigationBar`), Album detail with track list, and a Now Playing screen reached via `<LayoutScreen>` + `<LayoutConfig>` that morphs the album artwork from the source. Below the phone frame, a toggle panel swaps the Library → Album push transition (layout / cupertino / material / none) and toggles the shared bar so the difference is felt directly. The previous commerce demo is removed in favor of standalone, embed-friendly screen and bar units that can be lifted into individual docs pages in a later pass.

### Patch Changes

- Updated dependencies [[`1aef7de`](https://github.com/kimjh96/flemo/commit/1aef7de948d0a9edce6b48419558e468226c9eb4), [`819fa1f`](https://github.com/kimjh96/flemo/commit/819fa1f0ee75ff1540b79b811ff6953eeff3bc20), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335), [`3a727cb`](https://github.com/kimjh96/flemo/commit/3a727cb2bf589147a1a7759a7a1f9e99b28d7926), [`58c930b`](https://github.com/kimjh96/flemo/commit/58c930bfcd30874f072d2567d255d2e283fe08f6), [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58)]:
  - @flemo/react@1.0.0
  - @flemo/react-layout@0.1.0
