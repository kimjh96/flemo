# @flemo/core

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
