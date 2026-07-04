# @flemo/core

## 1.10.1

### Patch Changes

- [`3580635`](https://github.com/kimjh96/flemo/commit/3580635dabf45d9ce23743ff17440750e4bc9ffe) Keep the screen and the URL in lockstep under rapid back/forward traversals across a nested Router boundary. A traversal task whose Router unmounted before it ran now aborts instead of deadlocking the shared navigation queue; a nested Router derives its history-state key from its enclosing screen's entry id so a remount can read the frames its previous incarnation wrote; a traversal that cannot be faithfully classified adopts the entry without a transition instead of ignoring it; and a remounted Router no longer renames a history entry the browser had already moved past.

## 1.10.0

### Minor Changes

- [`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586) Protect transitions from image re-decode and reveal-raster jank, whatever assets a consumer uses. A frozen screen's decoded images are discarded by the browser; the anim-hold release now waits (bounded) for the entering screen's images to re-decode, a covered screen entering on pop parks at its destination during the hold so its tiles pre-rasterize (gated on the covering screen's background being opaque, with the paused hold as fallback), and every unfreeze eagerly re-decodes the screen's images so a swipe reveal — which no hold can cover — starts warming immediately.

## 1.9.0

### Minor Changes

- [`40d8584`](https://github.com/kimjh96/flemo/commit/40d8584c75291b96b10a3cda59c93d40acc3209c) Finish the framework-neutralization pass: `resolveTransition` (name → registered transition with the `none` fallback) and `subscribeStepParamsRestore` (step-frame param restore on back/forward) move into `@flemo/core`, and the React binding delegates to them. No behavior change.

## 1.8.0

### Minor Changes

- [`4e54577`](https://github.com/kimjh96/flemo/commit/4e545777a41fa1dac7b23aba193cc85f3cf73c7f) Move every framework-neutral piece of the React binding into `@flemo/core` so future bindings (Svelte, Solid) reuse it: `createStepController` (step push/replace/pop orchestration), `createRouterScope` (store-bundle creation/seeding, with the `FlemoStores` type), `buildRoutePath`, `matchesPathname`, `enteringInitialStyle`, `registerTransitionDefinitions`, `observeBarHeight`, and `observeViewportScrollHeight`. `@flemo/react` now delegates to them with no behavior change.

## 1.7.0

### Minor Changes

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Fix a shared bar riding a frame behind its screen on browser-back navigation. `data-flemo-bar-riding` is now computed in render and committed alongside the bar's status, so the bar starts its keyframe in the same frame as the screen for any transition and any trigger (a programmatic `pop` or the browser back button). The internal `driveBarRiding` engine helper is replaced by the pure `computeBarRiding`.

### Patch Changes

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Anchor a transition's start to the screen's first painted frame. iOS WebKit starts the animation clock when the style commits, so a heavy entering screen (large list, fetch-on-mount) burned the opening of the transition rasterizing its first frame and the animation visibly skipped ahead; the animation is now held paused for the first two frames and then plays its full duration against already-painted layers.

## 1.6.1

### Patch Changes

- [`7513f82`](https://github.com/kimjh96/flemo/commit/7513f82eac7788d7c49ba57efd248a60b4d906f2) Fix the swipe-back gesture not starting. The controller located the previous screen through a freeze wrapper element that the React `<Activity>`-based screen freeze no longer renders, so the drag found no screen to reveal and bailed. It now walks direct sibling containers to find the previous screen.

## 1.6.0

### Minor Changes

- [`9937291`](https://github.com/kimjh96/flemo/commit/993729187939f96122381cd740343a7a8878efc1) Expose pluggable history drivers. `createNavigationController` / `createHistorySync` can now run against an injected `HistoryDriver` instead of the browser History API: `createBrowserHistoryDriver` (the default) or `createMemoryHistoryDriver` for a local, in-memory stack.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Let a Router run on a custom history backend. Router accepts a `createDriver` factory, and HistoryDriver gains `readPathname()`, so the Router reads and writes the URL only through its driver. A wrapper (e.g. a locale-aware driver that keeps a `/ko` prefix in the address bar while the Router matches unprefixed paths) can now own the whole URL surface without the Router touching window.location directly.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add a per-Router `history` prop (`"browser"` default, `"memory"` opt-in) that decouples the history backend from nesting. A nested `<Router>` now participates in browser back/forward by default, while `history="memory"` keeps its previous isolated in-memory stack. Browser Routers namespace their `window.history.state` by a stable key and use a per-Router self-pop guard so multiple browser Routers coexist without clobbering each other.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Rename the `Screen` bar props to position-based, platform-neutral names: `appBar` to `topBar`, `navigationBar` to `bottomBar`, `sharedAppBar` to `sharedTopBar`, `sharedNavigationBar` to `sharedBottomBar` (the exported `SharedBarPresence` fields rename to match). Behavior is unchanged. This is a breaking rename: update any `Screen` that sets these props. The old `navigationBar` was easy to misread since it means the top bar on iOS and the web, while flemo uses it for the bottom one.

### Patch Changes

- [`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13) A `<Router>` nested inside another is now a local transition region: it runs its own in-memory history (no browser back/forward, no URL change) and contains its screens to its box via `position: absolute`, so only that region transitions while the surrounding layout (sidebars, headers) persists. A root `<Router>` is unchanged.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Make usePathname report a pop's destination immediately, consistent with push. The history store tracks a `pendingIndex` that advances to the target as soon as a pop starts (the render index still lags on the leaving screen until the transition resolves), and usePathname reads it. A browser Back no longer leaves chrome (active nav highlight, breadcrumbs) on the old route until the back animation finishes.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Fix useStep losing the screen's params in a keyed browser Router (a nested Router, or more than one Router on the page). pushStep/popStep and the step param restoration now go through the Router's own driver and self-pop guard, so closing a step (close button or browser Back) returns to the screen it was opened from instead of resetting to the first one. A deep-linked screen now seeds its params into the history frame too.

## 1.5.0

### Minor Changes

- [`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1) Add progress-driven part transitions. `createPartTransition` defines a named, status×active animation for a single element (any CSS property), and `<Part name="...">` runs it on that element anywhere inside a screen: an app/navigation bar child, body content, anything. Programmatic transitions play on the compositor with no React re-render, and the same definition follows the swipe-back drag inline. Register the transitions through the `Router`'s `partTransitions` prop. `createRawPartTransition` gives full per-variant control.

## 1.4.0

### Minor Changes

- [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6) Make the navigation stores request-scoped so screens render during SSR. The
  history/navigate/transition/screen stores are no longer module-level singletons
  shared across every SSR request; the Router now creates one bundle per mount,
  seeds it from `initPath`, and provides it via context. Because the seed is the
  store's initial state, zustand hands it to React as the server snapshot, so the
  screen stack paints on the server (previously the root was empty until the
  client mounted) and each concurrent request keeps its own stack.

  The public API (`Router`, `Route`, `useNavigate`, `useParams`, `useScreen`,
  `Screen`, `LayoutScreen`) is unchanged. Internally, `@flemo/core` now exposes the
  stores as `createHistoryStore` / `createNavigateStore` / `createTransitionStore`
  factories instead of singleton hooks.

### Patch Changes

- [`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551) Roll up Renovate dependency updates. Bump runtime and peer ranges: `react`/`react-dom` to `^19.2.7`, `motion` to `^12.40.0`, `path-to-regexp` to `^8.4.2`, `zustand` to `^5.0.14`. Also refreshes web app and toolchain deps (next, fumadocs, tailwindcss, eslint, typescript, vite) with no API changes.

## 1.3.0

### Minor Changes

- [`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f) `useNavigate().pop` now accepts a `transitionName` to override the back animation — handy when collapsing several screens with `skip` / `until`, where the leaving top's own transition isn't the one you want. The override is applied in the same commit that starts the pop, so the original transition never paints a frame.

## 1.2.0

### Minor Changes

- [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef) `useNavigate().pop`, `replace`, and `push` now take an optional distance — `{ skip }` (a number of screens) or `{ until }` (a route pattern) — to reach a screen below the top in a single transition. The skipped screens are removed without ever painting, so they never flash by.

  All three reach the same target (`{ skip: n }` is the screen `n` below the top; `{ until }` is the nearest match) and differ only there: `pop` lands on it, `replace` replaces it (the target and everything above become the new screen), and `push` keeps it and stacks the new screen on top.

  `{ skip }` clamps to the stack depth; an unmatched `until` is a no-op for `pop`/`replace` and a plain push for `push`. Plain `pop()` / `replace(path)` / `push(path)` are unchanged.

### Patch Changes

- [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056) Make the cupertino transition's outgoing-screen parallax viewport-proportional. The previous screen now slides to `-30%` of the viewport width (matching iOS), instead of a fixed `-100px` that looked negligible on wide viewports and appeared to lag behind the incoming screen.

- [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056) Fade the material transition's outgoing screen as it slides up, so the previous screen dissolves instead of just nudging behind the incoming one. Swipe-back mirrors the same fade.

- [`6df7e4f`](https://github.com/kimjh96/flemo/commit/6df7e4fd5c3446771fbc9602d703273e75615af6) Drop the explicit cupertino easing from the overlay decorator's push/pop dim so it animates on the default ease curve.

## 1.1.2

### Patch Changes

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Align the `overlay` decorator's `enter` / `exit` duration and easing to cupertino's push / pop slides (0.7s / 0.6s, cubic-bezier(0.32, 0.72, 0, 1)). The keyframe now reaches its `to` value exactly when the screen status flips to COMPLETED, eliminating the `fill: both` hold sub-window where the rest-rule handoff could race against the compositor. Swipe handler durations stay at 0.3s so the gesture release remains responsive.

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Hold `overlay`'s `backgroundColor` static at the target dim across every variant so only `opacity` is keyframe-animated. Effective dim is now `opacity × 0.3` (linear) instead of the previous `opacity × bg_alpha` product (which produced ≈0.075 at midpoint — barely visible — and jumped to 0.3 only at the very end). The keyframe is also single-property, which avoids iOS Safari's known color-space interpolation quirks for `background-color` under a transformed ancestor and shrinks the `will-change` hint to `opacity` alone.

## 1.1.1

### Patch Changes

- [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93) Compile `contain: layout` and `pointer-events: none` into transitioning variant rules alongside `will-change`. Scoped to `PUSHING` and `REPLACING` only — the verbs that actually trigger a fresh screen mount. Pop is excluded: ScreenFreeze keeps the destination screen mounted so there's no mount work to isolate, and harness measurements showed a small but consistent regression on heavy-DOM exiting screens during pop attributable to containment-block evaluation cost. The hints activate only during the transition window and are released the instant the status flips back to `IDLE`/`COMPLETED`.

## 1.1.0

### Minor Changes

- [`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2) Fix `createDecorator` so the decorator transition runs on the right screen. Previously every `*-true` variant (active side) and every `*-false` variant (inactive side) was forced through the two-state `enter` / `exit` pair: `IDLE-true`, `PUSHING-true`, `POPPING-true`, and `COMPLETED-true` all mapped to `enter`, while `PUSHING-false`, `REPLACING-false`, and `COMPLETED-false` all mapped to `exit`. That collapse meant the active side had to use one value for both "active at rest" and "the entering animation's target," which only worked if the two were identical — for the built-in `overlay` they were (`opacity: 0` for both), and the result was that no decorator animation was visible at all on the new screen entering or the previous screen going behind.

  `createDecorator` now takes a required `idle` separate from `enter` / `exit`, with three distinct roles:
  - `idle` — resting position. Held at IDLE-*, COMPLETED-true, POPPING-true, and the *new\* screen during PUSH / REPLACE (`PUSHING-true` / `REPLACING-true`). The entering screen lands here so its decorator stays invisible on top of the new active screen.
  - `enter` — target for the screen moving INTO the background. Used on `PUSHING-false` / `REPLACING-false` (peak) and `COMPLETED-false` (settled). For overlays this is the dim state — the previous screen darkens.
  - `exit` — target for the previously-behind screen returning to active on `POPPING-false`. Animates from `enter` (its prior settled position) toward `exit`. Match `exit` to `idle` to land softly on the active rest rule.

  The built-in `overlay` decorator picks the new mapping up natively, so cupertino's push now darkens the screen sliding behind (was statically mounted before) and pop now smoothly clears the dim as the previous screen returns. Authors who used `createDecorator` directly must add an `idle` argument; per-state control via `createRawDecorator` is unchanged.

## 1.0.2

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.

## 1.0.1

### Patch Changes

- [`a6a3550`](https://github.com/kimjh96/flemo/commit/a6a35501ba640ed1cfa72e202fc4ef53cf487704) Stop appending `px` to CSS custom property values during transition compilation. `{ "--space": 16 }` now compiles to `--space: 16;` instead of `--space: 16px;`. Custom properties are typeless — flemo can't know whether the author intends pixels, a count, a ratio, or a multiplier — so the safe default is to pass the raw scalar through and let the call site shape the unit (e.g., `calc(var(--space) * 1px)` in CSS). Mirrors React's `name.startsWith("--")` short-circuit in inline-style coercion.

- [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb) Compositor-synced shared-bar ride-along. The previous rAF mirror loop read `getComputedStyle(scope)` and wrote inline styles onto the bars every frame — a main-thread roundtrip that left bars trailing the screen by one composited frame, especially visible on mobile. The compiled transition rule now emits a sibling selector targeting `[data-flemo-bar][data-flemo-bar-riding="true"]` with the same `@keyframes` the screen uses, so the bar runs the same animation on the same compositor pass — zero JS in the loop, pixel-exact sync. The rAF path is retained narrowly for swipe-drag, where the screen itself is already main-thread inline-driven and there is no compositor advantage to chase.

- [`f3e8ac9`](https://github.com/kimjh96/flemo/commit/f3e8ac9dd909fabc11621f6bd29449c286fb3bda) `TransitionTarget` now extends `csstype.Properties`, so every transition-able CSS property — `filter`, `backdropFilter`, `color`, `boxShadow`, `borderRadius`, `clipPath`, `letterSpacing`, and the rest of the CSS surface — gets full IDE autocomplete and value-type narrowing inside `createTransition({ initial, idle, enter, ... })`. The previous interface only typed transform shortcuts, `opacity`, and `backgroundColor`; every other property still worked at runtime thanks to the broad index signature, but offered zero editor support. flemo-specific transform aliases (`x`, `y`, `z`, `scale*`, `rotate*`) keep their existing semantics — csstype's own `rotate` / `scale` / `translate` standalone properties are omitted so the shortcut wins. CSS custom properties (`--foo`) remain animatable via a `--`-prefixed index signature.

- [`04a03d9`](https://github.com/kimjh96/flemo/commit/04a03d985d5517d87d570ea8b696dbaee3ef334e) Stop appending `px` to unitless CSS property values during transition compilation. Numbers passed to `lineHeight`, `fontWeight`, `zIndex`, `flexGrow`, `flexShrink`, `aspectRatio`, `columnCount`, `order`, `tabSize`, SVG opacity / stroke numerics, and similar unitless properties now compile straight through (`{ lineHeight: 1.5 }` → `line-height: 1.5;`). Previously the compiler defaulted any non-transform number to `…px`, which emitted invalid declarations like `line-height: 1.5px`. String values were already passed through verbatim, so the existing `"1.5"` workaround stays compatible. Mirrors the well-known unitless-property allowlist React uses for inline styles.

## 1.0.0

### Major Changes

- [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616) - Stabilize the public API at 1.0.0. The screen / transition / navigate / store surfaces (Router, Route, Screen, useNavigate, useStep, useScreen, useParams, createTransition, createDecorator, TaskManger, history & navigate stores) are now SemVer-major versioned — future breaking changes go through an explicit major bump and a migration note in this changelog. `@flemo/react-layout` stays in `0.x` until its motion-free FLIP migration lands.

### Minor Changes

- [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44) - Initial release of `@flemo/core` — flemo's framework-agnostic primitives. Contains the navigation queue (`TaskManger`), history + navigate zustand stores, the self-pop guard, the transition + decorator factories with built-in presets (`cupertino`, `material`, `layout`, `none`, `overlay`), the CSS keyframes compiler, and pure utilities (`isServer`, `getParams`, `getMatchedPathPattern`, `findScrollable`). No React or Motion runtime dependency — animation target types are defined locally. `@flemo/react` depends on it; consumers who only need transition primitives can install `@flemo/core` directly.

- [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335) - Restore coexistence with consumer overlays (bottom sheets, dialogs) that rely on `position: fixed` and z-index. The screen scope no longer establishes a containing block or stacking context at rest: identity transform targets compile to `transform: none`, and the screen wrapper uses `contain: layout style` instead of `contain: strict`. The shared app/navigation bar ride-along is now generic over every property a transition writes — `collectAnimatedProperties` is mirrored from scope to bar each frame — so authoring a custom transition with `opacity`, `filter`, or any other CSS property no longer leaves the bar out of sync.

### Patch Changes

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - `findScrollable` correctness + side-effect fixes that show up on every swipe-back pointerdown:
  - `canProgrammaticallyScroll` no longer mutates the candidate's `scrollTop` / `scrollLeft` to probe scrollability. It now reads `overflowX` / `overflowY` from computed style instead — same intent (does this element actually scroll on this axis?) without firing scroll events or interfering with `scroll-snap` / `scroll-behavior: smooth` consumers.
  - The ancestor walk no longer stops at `document.body`, so viewport-level scrolling on `<html>` (`documentElement`) — the default for many apps — is now detected as a scroll boundary and gates swipe-back correctly.
  - `getStartElement` now returns `null` instead of force-casting non-Element event targets (`document`, `window`, `Text`) to `HTMLElement`, avoiding a downstream crash in the parent-walk loop.

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Fix `TaskManager.resolveTask` rejecting `SIGNAL_PENDING` tasks. `emitSignal` delegates to `resolveTask`, so the previous status guard turned signal mode (`control.signal`) into a permanent no-op — any task parked on a signal would have hung indefinitely. Both `MANUAL_PENDING` and `SIGNAL_PENDING` now flow through the same resolution path.

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Emit `will-change` on each compiled transition's variant rule, derived from the exact set of properties the transition writes — whatever the author put in `initial` / variant `value`s. The hint applies while the variant's status selector matches (PUSHING/POPPING/REPLACING) and releases the moment status flips back to IDLE/COMPLETED, so the compositor layer is allocated only for the animation window. Shared bars riding along via JS mirroring receive the same per-transition property set. Sustained 60fps for any author-defined transition target, not just transform/opacity.
