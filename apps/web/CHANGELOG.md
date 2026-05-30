# @flemo/web

## 0.2.8

### Patch Changes

- [`6e26b1d`](https://github.com/kimjh96/flemo/commit/6e26b1d5efa650a1e20db4a702c25214c1788fe6) Tidy the playground to match the workspace conventions: add the missing `"use client"` directive to the interactive segment/toggle/transition-picker components, drop decorative box-shadows in favor of the 1px-border design-system rule, move the bottom-sheet scrim and phone-frame ring onto theme tokens, and return `albumById` as `Album | null`.

  Move the performance/benchmark controls out of the in-app Library screen into a dedicated card in the developer panel, so the music app preview (and the embedded landing hero) stays free of developer buttons.

- [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef) `useNavigate().pop`, `replace`, and `push` now take an optional distance — `{ skip }` (a number of screens) or `{ until }` (a route pattern) — to reach a screen below the top in a single transition. The skipped screens are removed without ever painting, so they never flash by.

  All three reach the same target (`{ skip: n }` is the screen `n` below the top; `{ until }` is the nearest match) and differ only there: `pop` lands on it, `replace` replaces it (the target and everything above become the new screen), and `push` keeps it and stacks the new screen on top.

  `{ skip }` clamps to the stack depth; an unmatched `until` is a no-op for `pop`/`replace` and a plain push for `push`. Plain `pop()` / `replace(path)` / `push(path)` are unchanged.

- Updated dependencies ([`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef)):
  - @flemo/react@1.1.0
  - @flemo/react-layout@0.1.7

## 0.2.7

### Patch Changes

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Fix the white flash on the landing page's HeroDemo while the playground iframe is still loading in dark mode. The phone-frame interior and the loading-dot panel now use `var(--color-surface)` instead of a hardcoded `bg-white`, so they track the active theme and the iframe transitions in over a matching backdrop.
- Updated dependencies:
  - @flemo/react@1.0.6
  - @flemo/react-layout@0.1.6

## 0.2.6

### Patch Changes

- [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93) Add a "Perf scenarios" section to the playground's Library screen that pushes a synthetic Heavy Arrival screen with adjustable render-body CPU and tree size. Backs the new `heavy-screen.spec.ts` A/B harness measuring flipLatency, rAF cadence, and `long-animation-frame` entries with and without the compositor isolation hints.
- Updated dependencies ([`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93)):
  - @flemo/react@1.0.5
  - @flemo/react-layout@0.1.5

## 0.2.5

### Patch Changes

- [`541c526`](https://github.com/kimjh96/flemo/commit/541c52604f5a3d2f8c2257f09c1ba731b80a0c54) Update the API reference table so the `createDecorator` row reflects the four-slot signature (`initial / idle / enter / exit`). The previous "six-phase" label was already a copy-paste from `createTransition` and is doubly stale now that `createDecorator` requires `idle`.

## 0.2.4

### Patch Changes

- Updated dependencies ([`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2)):
  - @flemo/react@1.0.4
  - @flemo/react-layout@0.1.4

## 0.2.3

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.

- [`077cf72`](https://github.com/kimjh96/flemo/commit/077cf727bc41db8d6954b4aee331783ea035daba) Reframe the playground transitions panel: by default each push uses the transition that fits its own affordance (cupertino for browse-deeper hops, material for the player), set inline at every call site — there's no "harmonized" meta-option. The picker still exposes Built-in (cupertino / material / none) and Custom (blur) chips, but selecting one now **overrides** every push for comparison; tapping the active chip again drops back to the per-context default. The `resolvePushTransition` helper and its `_utils` folder are gone — the right model is "each navigation composes its own transition," not "a global resolver picks one." The code peek mirrors this: by default it shows the inline-per-site snippet, and only switches to a single `createTransition` source when an override is active.
- Updated dependencies ([`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937), [`077cf72`](https://github.com/kimjh96/flemo/commit/077cf727bc41db8d6954b4aee331783ea035daba)):
  - @flemo/react@1.0.3
  - @flemo/react-layout@0.1.3

## 0.2.2

### Patch Changes

- [`ee88080`](https://github.com/kimjh96/flemo/commit/ee8808088daee670a2601caa5a2bf52c0ccc1388) Unify the Korean docs voice to 해요체. The `layout-screen.ko.mdx` page mixed `~합니다` / `~입니다` (formal polite) with `~해요` / `~이에요` (informal polite) sentence endings on a per-paragraph basis; every other Korean docs page was already 해요체 throughout. Converted all 32 occurrences to 해요체 across `layout-screen.ko.mdx` and one straggler in `screen.ko.mdx`, including the headings that quote a hypothetical user's complaint ("모프가 일어나지 않고 페이드만 됩니다" → "...페이드만 돼요" etc.) so the voice stays consistent on every line.

- [`ee88080`](https://github.com/kimjh96/flemo/commit/ee8808088daee670a2601caa5a2bf52c0ccc1388) Fix the Pretendard Variable font 404. The previous URL pointed at `cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable.woff2` — but jsdelivr's `gh/` endpoint started returning 404 for this path, and the file was also reorganized: in `pretendard@1.3.9` the variable WOFF2 lives under a `woff2/` subdirectory (`dist/web/variable/woff2/PretendardVariable.woff2`), not directly in `dist/web/variable/`. Switched the URL to the npm-published `pretendard@1.3.9` via jsdelivr at the correct path. Verified `HTTP 200` with `content-type: font/woff2`.
- Updated dependencies ([`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350), [`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350)):
  - @flemo/react@1.0.2
  - @flemo/react-layout@0.1.2

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
