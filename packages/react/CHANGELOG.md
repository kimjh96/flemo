# @flemo/react

## 1.5.0

### Minor Changes

- [`f04a8d1`](https://github.com/kimjh96/flemo/commit/f04a8d17c587d7ab930e548a45497d63fa85bf95) Add `<Layer>`: lift an overlay (bottom sheet, dim backdrop, FAB, toast) out of a screen's content-isolation box up to the scope level, so it floats over the screen and rides the transition instead of being trapped (and flashed mid-transition) inside the inset, scrollable content box. Put it inside a reusable overlay component once and every call site gets the escape for free; outside a `<Screen>` it renders in place. This resolves the backdrop / overlay / WebKit trilemma: the content layer keeps `backdrop-filter` working while overlays escape via `<Layer>`.

- [`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13) A `<Router>` nested inside another is now a local transition region: it runs its own in-memory history (no browser back/forward, no URL change) and contains its screens to its box via `position: absolute`, so only that region transitions while the surrounding layout (sidebars, headers) persists. A root `<Router>` is unchanged.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Let a Router run on a custom history backend. Router accepts a `createDriver` factory, and HistoryDriver gains `readPathname()`, so the Router reads and writes the URL only through its driver. A wrapper (e.g. a locale-aware driver that keeps a `/ko` prefix in the address bar while the Router matches unprefixed paths) can now own the whole URL surface without the Router touching window.location directly.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add a per-Router `history` prop (`"browser"` default, `"memory"` opt-in) that decouples the history backend from nesting. A nested `<Router>` now participates in browser back/forward by default, while `history="memory"` keeps its previous isolated in-memory stack. Browser Routers namespace their `window.history.state` by a stable key and use a per-Router self-pop guard so multiple browser Routers coexist without clobbering each other.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Freeze inactive screens with React's `<Activity>` instead of a manual
  display:none wrapper. Hidden screens keep their DOM state (scroll position, form
  values, media) and restore it when shown again, while their effects now suspend
  while hidden and remount on show, so timers and subscriptions no longer run on
  screens the user can't see. Requires React 19.2+.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add `usePathname`, a public hook that returns the active pathname reactively. It lets chrome rendered outside a `<Screen>` (a header or sidebar) highlight the current route without reaching into the stores.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) `useStep` now works outside a `<Screen>`, so persistent UI like a header menu or a sidebar can drive a history-backed step that the Back button closes. Pass the param type for inference (`useStep<{ menu: boolean }>()`); inside a `<Screen>` it behaves exactly as before.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Rename the `Screen` bar props to position-based, platform-neutral names: `appBar` to `topBar`, `navigationBar` to `bottomBar`, `sharedAppBar` to `sharedTopBar`, `sharedNavigationBar` to `sharedBottomBar` (the exported `SharedBarPresence` fields rename to match). Behavior is unchanged. This is a breaking rename: update any `Screen` that sets these props. The old `navigationBar` was easy to misread since it means the top bar on iOS and the web, while flemo uses it for the bottom one.

- [`f9f0214`](https://github.com/kimjh96/flemo/commit/f9f02140b091903ffa9f7a64494a5c1d8d56b084) Add `<Slot>`: mark where the screen stack renders inside a layout. Put your `<Route>`s in a `<Slot>` and lay the rest of the screen (sidebar, header, footer) around it. Only that region transitions between routes while everything outside it persists. It stays one `<Router>`, one history, one `navigate`, so a sidebar's `useNavigate` drives the region with no extra wiring.

### Patch Changes

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Make usePathname report a pop's destination immediately, consistent with push. The history store tracks a `pendingIndex` that advances to the target as soon as a pop starts (the render index still lags on the leaving screen until the transition resolves), and usePathname reads it. A browser Back no longer leaves chrome (active nav highlight, breadcrumbs) on the old route until the back animation finishes.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) `Router` now splits a query off `initPath` (such as `/playground/1?code=x`) and seeds the matched route's params from it, so a deep link or refresh renders the right step state on load. A plain `initPath` with no query is unchanged.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Fix useStep losing the screen's params in a keyed browser Router (a nested Router, or more than one Router on the page). pushStep/popStep and the step param restoration now go through the Router's own driver and self-pop guard, so closing a step (close button or browser Back) returns to the screen it was opened from instead of resetting to the first one. A deep-linked screen now seeds its params into the history frame too.
- Updated dependencies ([`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13), [`9937291`](https://github.com/kimjh96/flemo/commit/993729187939f96122381cd740343a7a8878efc1), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912)):
  - @flemo/core@1.6.0

## 1.4.2

### Patch Changes

- [`e316444`](https://github.com/kimjh96/flemo/commit/e316444d3327df09569cd4568eb697878da85bff) Keep consumer `backdrop-filter` rendering during transitions. The content-isolation layer now promotes with `transform: translateZ(0)` instead of `will-change: opacity`, so a frosted header inside a screen no longer washes out mid-transition.

## 1.4.1

### Patch Changes

- [`080024f`](https://github.com/kimjh96/flemo/commit/080024f7daa158c4ed36ba25d516eaaa04908aa5) Fix consumer `position: fixed` overlays (e.g. bottom sheets) jumping or flashing across the screen during transitions. The content layer is now promoted with `will-change: opacity` instead of a transform, so it no longer establishes a containing block that re-parents those overlays into the scrollable content box mid-transition. Overlays stay pinned to the screen and ride the transition cleanly.

## 1.4.0

### Minor Changes

- [`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1) Add progress-driven part transitions. `createPartTransition` defines a named, status×active animation for a single element (any CSS property), and `<Part name="...">` runs it on that element anywhere inside a screen: an app/navigation bar child, body content, anything. Programmatic transitions play on the compositor with no React re-render, and the same definition follows the swipe-back drag inline. Register the transitions through the `Router`'s `partTransitions` prop. `createRawPartTransition` gives full per-variant control.

### Patch Changes

- Updated dependencies ([`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1)):
  - @flemo/core@1.5.0

## 1.3.2

### Patch Changes

- [`05cc7eb`](https://github.com/kimjh96/flemo/commit/05cc7eba37ede2ca088c1ea73116a9b99388f7f6) Fix transitions skipping ahead on WebKit when a screen's content updates mid-transition (e.g. an async fetch resolving). The content is now isolated onto its own compositing layer while a transition is in flight, so the repaint no longer stalls the animating layer's presentation. Applies to every transition, including custom ones.

## 1.3.1

### Patch Changes

- [`343ea33`](https://github.com/kimjh96/flemo/commit/343ea3331ed5ac3f087fdf8fb0ed0a9ebf4c1062) Keep the shared app/navigation bar spacer height stable while a screen is frozen (`display: none`) during a transition. The ResizeObserver reports a height of 0 for the frozen screen; using it collapsed the spacer, and WebKit then clamped `scrollTop` to the smaller scroll range without restoring it on unfreeze, so short pages jumped on navigation. The measurement now ignores 0 and holds the last real height.

## 1.3.0

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
- Updated dependencies ([`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551), [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6)):
  - @flemo/core@1.4.0

## 1.2.0

### Minor Changes

- [`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f) `useNavigate().pop` now accepts a `transitionName` to override the back animation — handy when collapsing several screens with `skip` / `until`, where the leaving top's own transition isn't the one you want. The override is applied in the same commit that starts the pop, so the original transition never paints a frame.

### Patch Changes

- Updated dependencies ([`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f)):
  - @flemo/core@1.3.0

## 1.1.0

### Minor Changes

- [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef) `useNavigate().pop`, `replace`, and `push` now take an optional distance — `{ skip }` (a number of screens) or `{ until }` (a route pattern) — to reach a screen below the top in a single transition. The skipped screens are removed without ever painting, so they never flash by.

  All three reach the same target (`{ skip: n }` is the screen `n` below the top; `{ until }` is the nearest match) and differ only there: `pop` lands on it, `replace` replaces it (the target and everything above become the new screen), and `push` keeps it and stacks the new screen on top.

  `{ skip }` clamps to the stack depth; an unmatched `until` is a no-op for `pop`/`replace` and a plain push for `push`. Plain `pop()` / `replace(path)` / `push(path)` are unchanged.

### Patch Changes

- Updated dependencies ([`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056), [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056), [`6df7e4f`](https://github.com/kimjh96/flemo/commit/6df7e4fd5c3446771fbc9602d703273e75615af6), [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef)):
  - @flemo/core@1.2.0

## 1.0.6

### Patch Changes

- Updated dependencies ([`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79), [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79)):
  - @flemo/core@1.1.2

## 1.0.5

### Patch Changes

- [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93) Move `ScreenMotion`'s transition-lifecycle `animationend` listener (and the COMPLETED-branch inline-style cleanup) from `useEffect` to `useLayoutEffect`. The listener now attaches synchronously during commit, before the browser paints the first animation frame, closing a tiny race where a very short variant could finish before a post-commit `useEffect` attached. The pre-paint cleanup also means the browser never paints a transient frame with stale inline styles overlapping the rest CSS rule. Measurable cost in the production-ship configuration (with the compositor isolation hints active) is zero.
- Updated dependencies ([`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93)):
  - @flemo/core@1.1.1

## 1.0.4

### Patch Changes

- [`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2) Fix `createDecorator` so the decorator transition runs on the right screen. Previously every `*-true` variant (active side) and every `*-false` variant (inactive side) was forced through the two-state `enter` / `exit` pair: `IDLE-true`, `PUSHING-true`, `POPPING-true`, and `COMPLETED-true` all mapped to `enter`, while `PUSHING-false`, `REPLACING-false`, and `COMPLETED-false` all mapped to `exit`. That collapse meant the active side had to use one value for both "active at rest" and "the entering animation's target," which only worked if the two were identical — for the built-in `overlay` they were (`opacity: 0` for both), and the result was that no decorator animation was visible at all on the new screen entering or the previous screen going behind.

  `createDecorator` now takes a required `idle` separate from `enter` / `exit`, with three distinct roles:
  - `idle` — resting position. Held at IDLE-*, COMPLETED-true, POPPING-true, and the *new\* screen during PUSH / REPLACE (`PUSHING-true` / `REPLACING-true`). The entering screen lands here so its decorator stays invisible on top of the new active screen.
  - `enter` — target for the screen moving INTO the background. Used on `PUSHING-false` / `REPLACING-false` (peak) and `COMPLETED-false` (settled). For overlays this is the dim state — the previous screen darkens.
  - `exit` — target for the previously-behind screen returning to active on `POPPING-false`. Animates from `enter` (its prior settled position) toward `exit`. Match `exit` to `idle` to land softly on the active rest rule.

  The built-in `overlay` decorator picks the new mapping up natively, so cupertino's push now darkens the screen sliding behind (was statically mounted before) and pop now smoothly clears the dim as the previous screen returns. Authors who used `createDecorator` directly must add an `idle` argument; per-state control via `createRawDecorator` is unchanged.

- Updated dependencies ([`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2)):
  - @flemo/core@1.1.0

## 1.0.3

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.

- [`077cf72`](https://github.com/kimjh96/flemo/commit/077cf727bc41db8d6954b4aee331783ea035daba) Extend the active-settle defensive cleanup to this screen's shared bars. The previous patch ([[stale-inline-swipe-styles]]) cleaned `scopeRef` and `decoratorRef` when a screen finished settling as active, but the shared `appBar` / `navigationBar` refs were not in the cleanup set. The swipe-mirror writes inline `transform` / `opacity` / `filter` / etc. to bars in lockstep with the screen, and if any release path is missed (interleaved navigation, a partner whose ride-along path didn't finalize, an unusual transition-driver order) the bar would sit at the swipe-time position even after the owning screen settled as active — same symptom class as the screen bug, just on the bar. Now bars are stripped of their inline styles and `will-change` hint in the same useEffect that handles the screen, so the compiled CSS rest rule cleanly owns the bar at rest.
- Updated dependencies ([`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937)):
  - @flemo/core@1.0.2

## 1.0.2

### Patch Changes

- [`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350) Two-layer fix for stale inline swipe styles surviving a navigation cycle and resurfacing on a later visit. flemo keeps inactive screens mounted via `display: none` (`ScreenFreeze`), so any inline `transform` / `opacity` / `filter` / `backgroundColor` / etc. that a swipe handler wrote via `animateInline` outlives the original navigation. Because inline styles beat the compiled CSS rest rule (`animation-fill-mode: forwards`), the screen renders at the stale "previous-screen waiting" position when it next becomes active.

  First layer — make `clearInlineAnimation` actually clean what `animateInline` wrote: a per-element WeakMap tracks every property animateInline sets, and the default-branch cleanup now strips exactly that surface. Previously it only removed `transform` + `opacity`, leaking any other animated property (e.g., `filter` on a custom blur transition). Untracked elements still fall back to the transform + opacity pair for defensive behavior.

  Second layer — defensive cleanup in `ScreenMotion`: every time a screen settles as the active topmost screen (`status === "COMPLETED"`), strip leftover inline animation styles and the `data-flemo-skip-animation` marker on the scope and decorator. This catches stale state from any path — the swipe-commit branch (which intentionally leaves the screen at its final inline position), interleaved navigation mid-cancel, custom transitions, decorators, anything — without needing each path to remember to clean up.

- [`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350) Eliminate the one-frame lag between a screen and its riding shared bars during user-driven swipe drag. The previous swipe mirror was a `requestAnimationFrame` loop that read `getComputedStyle(scope)` and wrote the value back to each bar — but rAF runs in its own JS tick separate from the `pointermove` handler that just wrote the screen, so the bar's commit always landed in the next paint pass. On mobile and slower devices this trailed visibly even though push / pop transitions (compositor-driven via the keyframe sibling selector) were already pixel-perfect.

  The mirror is now synchronous. `animateInline` is wrapped at the swipe lifecycle boundary (`beginSwipe` / `continueSwipe` / `endSwipe`) and intercepts every write to `currentScreen` or `prevScreen`, mirroring it to whichever bars ride that screen in the SAME JS tick. There is no rAF, no `getComputedStyle` read, no second pass — the browser composites the screen and the bars in one paint commit.

  Two ride lists are captured at `beginSwipe`: the current screen's bars (mirrored when the swipe handler writes to `currentScreen`), and the previous screen's bars (mirrored when it writes to `prevScreen` — both cupertino and material drive both screens per swipe tick). The previous-side bars are found by querying the partner screen container directly, so the swipe-driver doesn't need to reach into the partner ScreenMotion instance. Without this two-list split, an app whose previous screen owns a shared bar the current screen doesn't (e.g., a tab bar on the home screen, hidden on a detail screen) would see that bar fail to follow the swipe at all.

  The `will-change` hint moves to swipe-start so the riding bars pre-promote to their own compositing layer before the first inline write, and is cleared on swipe-end (or on commit, before `history.back()`, so the layer can be discarded cleanly). On commit, the previous-side bars are also stripped of any inline styles the swipe wrote — those would otherwise shadow the compiled CSS rest rule when the previous screen settles as active.

## 1.0.1

### Patch Changes

- [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb) Compositor-synced shared-bar ride-along. The previous rAF mirror loop read `getComputedStyle(scope)` and wrote inline styles onto the bars every frame — a main-thread roundtrip that left bars trailing the screen by one composited frame, especially visible on mobile. The compiled transition rule now emits a sibling selector targeting `[data-flemo-bar][data-flemo-bar-riding="true"]` with the same `@keyframes` the screen uses, so the bar runs the same animation on the same compositor pass — zero JS in the loop, pixel-exact sync. The rAF path is retained narrowly for swipe-drag, where the screen itself is already main-thread inline-driven and there is no compositor advantage to chase.
- Updated dependencies ([`a6a3550`](https://github.com/kimjh96/flemo/commit/a6a35501ba640ed1cfa72e202fc4ef53cf487704), [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb), [`f3e8ac9`](https://github.com/kimjh96/flemo/commit/f3e8ac9dd909fabc11621f6bd29449c286fb3bda), [`04a03d9`](https://github.com/kimjh96/flemo/commit/04a03d985d5517d87d570ea8b696dbaee3ef334e)):
  - @flemo/core@1.0.1

## 1.0.0

### Major Changes

- [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616) - Stabilize the public API at 1.0.0. The screen / transition / navigate / store surfaces (Router, Route, Screen, useNavigate, useStep, useScreen, useParams, createTransition, createDecorator, TaskManger, history & navigate stores) are now SemVer-major versioned — future breaking changes go through an explicit major bump and a migration note in this changelog. `@flemo/react-layout` stays in `0.x` until its motion-free FLIP migration lands.

### Minor Changes

- [`1aef7de`](https://github.com/kimjh96/flemo/commit/1aef7de948d0a9edce6b48419558e468226c9eb4) - Switch screen transitions from Motion's JS-driven `animate()` to compiled CSS keyframes. Each registered transition is compiled once at mount into a `<style data-flemo>` tag and applied via `data-flemo-status` / `data-flemo-active` attributes, so push, pop, and replace animations run on the compositor and stop competing with React renders on the main thread. Heavy screens (large trees, Suspense suspends) no longer drop the first frames of their entrance animation. Swipe-back stays imperative: pointer events drive inline `transform`/`opacity` during the drag, then a short inline CSS transition settles the screen and the keyframe pipeline takes over on `history.back()`. Custom transitions keep the same `createTransition({ initial, idle, enter, ... })` shape — the swipe handler signature drops Motion's `PanInfo`/`DragControls` in favor of native `PointerEvent` and a `SwipeInfo` object with the same `offset`/`velocity`/`point`/`delta` fields.

- [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44) - Initial release of `@flemo/react` — the React bindings for flemo, replacing the previous `flemo` npm package. Contains `Router`, `Route`, `Screen`, `ScreenMotion`, `ScreenDecorator`, `ScreenFreeze`, the `useNavigate` / `useStep` / `useScreen` / `useParams` hooks, the `HistoryListener`, the `Renderer`, and the `useTransitionStyles` insertion-effect hook that injects the compiled keyframes. Depends on `@flemo/core` for framework-agnostic primitives — no motion peer dependency. Migration: anywhere you wrote `import { ... } from "flemo"` becomes `import { ... } from "@flemo/react"`, and `declare module "flemo"` becomes `declare module "@flemo/react"`. `LayoutScreen` and `LayoutConfig` moved to the new `@flemo/react-layout` package — install it (`pnpm add @flemo/react-layout motion`) only if you use `layoutId`-based shared-element morphs.

- [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335) - Restore coexistence with consumer overlays (bottom sheets, dialogs) that rely on `position: fixed` and z-index. The screen scope no longer establishes a containing block or stacking context at rest: identity transform targets compile to `transform: none`, and the screen wrapper uses `contain: layout style` instead of `contain: strict`. The shared app/navigation bar ride-along is now generic over every property a transition writes — `collectAnimatedProperties` is mirrored from scope to bar each frame — so authoring a custom transition with `opacity`, `filter`, or any other CSS property no longer leaves the bar out of sync.

- [`3a727cb`](https://github.com/kimjh96/flemo/commit/3a727cb2bf589147a1a7759a7a1f9e99b28d7926) - Fix consecutive `pop()` / `popStep()` calls running out of order. All screen navigation (`push`, `replace`, `pop`) and step navigation (`pushStep`, `replaceStep`, `popStep`) now serialize onto a single ordered queue and execute strictly in call order. Previously `pop()` and `popStep()` fired `window.history.back()` directly, which let the browser coalesce rapid back-traversals into one `popstate` and desync the stack.

- [`58c930b`](https://github.com/kimjh96/flemo/commit/58c930bfcd30874f072d2567d255d2e283fe08f6) - Isolate shared app and navigation bars from screen transitions. They now render outside the animated screen, so a transition's transform or opacity never affects them. When navigating to or from a screen that doesn't declare the same shared bar, the bar animates along with its own screen instead of staying pinned in place. Screen-level overlays that need to cover a shared bar should render in the browser top layer (`popover` / `<dialog>`).

### Patch Changes

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Emit `will-change` on each compiled transition's variant rule, derived from the exact set of properties the transition writes — whatever the author put in `initial` / variant `value`s. The hint applies while the variant's status selector matches (PUSHING/POPPING/REPLACING) and releases the moment status flips back to IDLE/COMPLETED, so the compositor layer is allocated only for the animation window. Shared bars riding along via JS mirroring receive the same per-transition property set. Sustained 60fps for any author-defined transition target, not just transform/opacity.

- Updated dependencies [[`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335), [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58)]:
  - @flemo/core@1.0.0
