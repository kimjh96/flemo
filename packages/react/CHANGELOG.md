# @flemo/react

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
