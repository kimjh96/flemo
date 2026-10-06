# Holds and release

Compute `holdKey = animHoldKey(...)` during render. Use render-phase `setAnimRelease` so hold and status attributes land in one commit, including for Activity-unfrozen screens.

`holdAttr` selects `true / park / park-under / park-over`. Park variants require the partner screen's registered opaque surface. `park-under` also sinks the outer container with `zIndex: -1`.

Release through the per-scope `AnimHoldCoordinator`, a pop-pair barrier stored in a module WeakMap keyed by the navigate store. Apply `decodeWait` only to screens waking from freeze.

The render-settle gate uses `contentSettle` and `settleGateActive()`:

- Enabled by default for touch WebKit, touch Blink, desktop macOS Safari, and the steady-60 desktop profile.
- All engines are eligible.
- Settings: firstWait 120 / cap 700 / grace 60, `renderSettleOnly`.

For authored `driver:"native"`, the governed-compiled touch-WebKit tier, and desktop macOS Safari, the release callback directly writes `data-flemo-anim-hold="false"` on scope, bars, and decorator inside the readiness rAF, and clears the park-under zIndex.

Every path `flushSync`s the state commit. The atomic attribute flip precedes React's render and commit work within that task, controlling their ordering.
