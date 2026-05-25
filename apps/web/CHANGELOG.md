# @flemo/web

## 0.2.1

### Patch Changes

- [`b9bc200`](https://github.com/kimjh96/flemo/commit/b9bc2004527b7821f74d11c487aa8cea85dc7d44) Rebrand the LayoutScreen status pill from "Beta" to "Experimental" — the API is gated on the motion-free FLIP migration rather than a release-train milestone, and "Beta" implied "GA is next" which doesn't match intent. The frontmatter flag is now `experimental: true` (was `beta: true`); the docs title and sidebar entry share one `ExperimentalPill` component for visual consistency. The LayoutScreen install snippet was also removed from the README so the README stays focused on the stable surface.

- [`af7d457`](https://github.com/kimjh96/flemo/commit/af7d457609655c331131f3264d32163645e5f09a) Make `harmonized` the default playground transition: cupertino for browse-deeper hops (Library / Search → Album) and material for the player (which closes with a downward chevron, so push and dismiss share one vertical axis). The transition picker now groups options as Default / Built-in / Custom — `blur` lives in Custom so it's clearly authored in the playground, not shipped from @flemo/core. Force-override any preset with a single click; the code peek shows the resolver rule when harmonized, or the `createTransition` source when forced.

- [`f5111b6`](https://github.com/kimjh96/flemo/commit/f5111b60cbe1183c1ede88a83ee11e602bcf95e4) Restructure the NowPlaying screen to drive Up Next / Lyrics through a bottom sheet instead of in-screen tabs — semantically a closer match for `useStep`, since the sheet's open state is URL/back-button reversible. The "Up Next" and "Lyrics" buttons each `pushStep` to open the sheet; the trailing swap chip inside the sheet uses `replaceStep` to flip contents in place without a close/reopen; the X button (or the system back button) `popStep`s the sheet shut. Album details are now shown inline by default — no toggle — so the screen leads with the artwork and the information you'd want at a glance. First playground surface that exercises every useStep verb in a flow that actually matches how a music app would model these affordances.

- [`9643b96`](https://github.com/kimjh96/flemo/commit/9643b96de103cd6569a8256e1a05719aeb7ebb82) Triple the playground music catalog so the demo screens actually scroll. The Library albums grid jumps from 6 to 18 entries, the Songs list shows up to 60 tracks, and Search's empty-state "Top Picks" surfaces all 18 albums instead of capping at 6. Lets visitors feel push/pop, swipe-back, and shared-bar behavior on screens that have real content beneath them.
- Updated dependencies ([`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb)):
  - @flemo/react@1.0.1
  - @flemo/react-layout@0.1.1

## 0.2.0

### Minor Changes

- [`f7ff70b`](https://github.com/kimjh96/flemo/commit/f7ff70bd3b5a09a9204b73c523e6e457d2886ef9) - Split the `LayoutScreen` section out of the Screen page into a dedicated docs entry with a deeper walkthrough — when to reach for it, the four-piece mental model (`transitionName: "layout"`, `layoutId`, `<LayoutConfig>`, `<LayoutScreen>`), why each piece exists, common patterns, expanded pitfalls, and when to skip morphing entirely.

- [`f834d4d`](https://github.com/kimjh96/flemo/commit/f834d4dae3088dd01c8385609987268aad99b03f) - Rebuild the playground from scratch around a minimal music-player demo: Library / Search tabs with a shared mini-player + tab-bar (`sharedNavigationBar`), Album detail with track list, and a Now Playing screen reached via `<LayoutScreen>` + `<LayoutConfig>` that morphs the album artwork from the source. Below the phone frame, a toggle panel swaps the Library → Album push transition (layout / cupertino / material / none) and toggles the shared bar so the difference is felt directly. The previous commerce demo is removed in favor of standalone, embed-friendly screen and bar units that can be lifted into individual docs pages in a later pass.

### Patch Changes

- Updated dependencies [[`1aef7de`](https://github.com/kimjh96/flemo/commit/1aef7de948d0a9edce6b48419558e468226c9eb4), [`819fa1f`](https://github.com/kimjh96/flemo/commit/819fa1f0ee75ff1540b79b811ff6953eeff3bc20), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335), [`3a727cb`](https://github.com/kimjh96/flemo/commit/3a727cb2bf589147a1a7759a7a1f9e99b28d7926), [`58c930b`](https://github.com/kimjh96/flemo/commit/58c930bfcd30874f072d2567d255d2e283fe08f6), [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58)]:
  - @flemo/react@1.0.0
  - @flemo/react-layout@0.1.0
