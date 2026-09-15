# ScreenMotion

`src/screen/ScreenMotion.tsx` concentrates the binding's motion wiring. Its responsibilities follow their order in the file.

## Engine lifecycle and subscriptions

Create one `createTransitionEngine` per screen, lazily through a ref, with minimal dependencies: a task id getter and two store setters. Call `driveScreenLifecycle` from `useLayoutEffect` with `[status, isActive, transitionName, prevTransitionName, animHold]`. Releasing anim-hold reruns it, allowing the compiled animation to start.

Only the top screen and the screen beneath it (`participatesInTransition`) subscribe to live status. Resting screens pin status to `"COMPLETED"`, keeping navigation re-renders O(1) rather than O(depth).

## Holds and release

Compute `holdKey = animHoldKey(...)` during render. Adjust hold state with render-phase `setAnimRelease` so hold and status attributes land in one commit, including for Activity-unfrozen screens.

`holdAttr` chooses `true / park / park-under / park-over`. Park variants require the partner screen's registered opaque surface; `park-under` also sinks the outer container with `zIndex: -1`.

Release through the per-scope `AnimHoldCoordinator`: a pop-pair barrier stored in a module WeakMap keyed by the navigate store. Apply `decodeWait` only to screens waking from freeze. The render-settle gate uses `contentSettle` and `settleGateActive()`:

- Enabled by default for touch WebKit, touch Blink, desktop macOS Safari, and the steady-60 desktop profile.
- All engines are eligible.
- Settings: firstWait 120 / cap 700 / grace 60, `renderSettleOnly`.

For authored `driver:"native"`, the governed-compiled touch-WebKit tier, and desktop macOS Safari, the release callback writes `data-flemo-anim-hold="false"` directly on scope, bars, and decorator inside the readiness rAF and clears the park-under zIndex. Every path `flushSync`s the state commit. The atomic attribute flip controls ordering within that task: it precedes React's render and commit work instead of following it.

## Swipe wiring and event behavior

A stable core `createSwipeController` reads live render values through the latest-ref pattern, `swipeEnvRef`. Pointer handlers forward native events. An active `touchmove` listener prevents native scroll only after the controller claims a drag.

Recognition requires 8px of movement and a 3:1 primary-axis lead, preventing vertical scroll jitter from becoming page-wide horizontal back. `pointercancel` always settles without navigation.

PUSHING/REPLACING destinations remain hit-testable so a touch started during flight can scroll after landing. The outer capture handler stops `click` before it reaches the target, suppressing both React handlers and native listeners on descendants of the React root until the transition completes. Listeners above the root (`document`/`window`) still observe the click. Lower-level pointer/mouse events remain observable to preserve native scroll targeting. Consumers should commit navigation from `click`, not `pointerdown`/`pointerup`.

## Bar riding and identity

During render, `computeBarRiding` sets `data-flemo-bar-riding` in the same commit as the bar's status attribute; the compiled sibling selector depends on both. When a drag is declared, swipe stages bars in the same call as their screen. When a transition drives its own screens, the controller synchronously mirrors writes onto the bars.

Bars hand over only when position and optional ID match. Two unlabelled bars retain legacy matching; a labelled bar never aliases an unlabelled bar or one with another label. DOM fallback IDs include `data-flemo-bar-id-type`, preserving numeric `3` versus string `"3"` when a frozen partner's registry has not reconnected.

## Entering styles and engine leases

`enteringInitialStyle` renders the active entering screen's from-pose as inline style for its first styled frame. Withhold it while parked because it would defeat the park rule.

An engine lease over `transform`/`opacity` captures this flemo-authored inline style as the original. This caused a desktop blank landing; the engine now strips the scope's pose channels at COMPLETED. Assume the engine may capture and restore any inline styles added here.

## Chrome, surfaces, and bar measurement

ScreenMotion wires status/system bars, shared top/bottom bars, the decorator, and the surface registry (`registerScreenSurface`). Surface opacity is computed from styles and re-measured on each status flip.

Shared-bar spacing has a pre-paint ordering contract:

1. The ref callback measures first, writing both the spacer and a measurement ref.
2. The registration layout effect publishes identity and height in one store notification.
3. `observeBarHeight` makes an idempotent initial report and tracks dynamic resizes.

A matching partner's registered height seeds the destination spacer during render, before its own bar measures. Re-registering the same ID preserves cached height; changing ID discards it.

## Scope promotion and SSR

The platform profile gates the scope's `will-change: transform` during the hold window and at rest on the top screen of a root Router. It supplies this decision for desktop Blink and the governed-compiled touch tier.

Every term is browser-only state, and the decision reaches the DOM as inline style. Read it through `useHydrationSafeFlag`, which uses `useSyncExternalStore` with a constant `false` server snapshot. Server and hydration renders therefore agree, and promotion arrives one commit later. A screen mounted for push/pop/replace is not hydrating and reads the live value in its first render.

Any other browser-derived value reaching the DOM must use the same gate. Inline styles and attributes are compared during hydration; `suppressHydrationWarning` is not an option.
