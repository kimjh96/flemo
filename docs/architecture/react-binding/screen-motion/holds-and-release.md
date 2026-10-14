# Holds and release

Compute `holdKey = animHoldKey(...)` during render. Use render-phase `setAnimRelease` so hold and status attributes land in one commit, including for Activity-unfrozen screens. Reset the imperative-release and park-head refs when the hold key changes. `releasedKeyRef` makes an interleaved render preserve a hold already released imperatively, even before React state reconciles.

`holdAttr` selects `true / park / park-under / park-over`. Park variants require the partner screen's registered opaque surface. An inactive participant uses `park`; an active PUSHING or REPLACING participant chooses `park-over` or `park-under` through the live platform profile. `park-under` sinks the outer container to `zIndex - 1`; its ordinary stack position is `zIndex + 1`.

Remember park-head eligibility for the current hold key when the hold uses `park` or `park-over`. Keep `data-flemo-park-head` through release while that key remains current. Do not grant it for `park-under`: restoring the container's stack position removes that variant's concealment.

Release through the per-scope `AnimHoldCoordinator`, a pop-pair barrier stored in a module WeakMap keyed by the navigate store. Append the current transition task ID to the group key when present so consecutive tasks do not share a release group. Apply `decodeWait` to wake-from-freeze holds; the mount initializer uses the current freeze state because no preceding commit exists.

The render-settle gate uses the live profile's `renderSettleGate` decision. When enabled, it applies to the active side of PUSHING and both sides of POPPING; REPLACING receives no content-settle options. The binding does not establish the profile's platform defaults.

- `firstWaitMs: 120`, `capMs: 700`, and `renderSettleOnly: true`.
- `graceMs: 60` only while mounting into a transition, otherwise `0`. A render with no hold marks the screen as having rested.
- `minNodes: 30` for the active side and `1` for the inactive returning side.

At release, read the authored native-driver flag from the latest transition ref and pass it to `resolvePlatformProfile`. If `atomicReleaseFlip` is enabled, directly write `data-flemo-anim-hold="false"` on connected scope, shared-bar, and decorator refs that already carry the attribute. Restore the outer container to `zIndex + 1` and record the released key. This direct loop does not include the overlay host.

If that direct flip occurred, `deferReleaseCommit` is enabled, and rAF exists, schedule state reconciliation in the next rAF. Otherwise use `flushSync`. Reconciliation updates state only if its key still matches the released hold. Thus the supplied implementation does not synchronously flush every release path; the imperative-release ref protects the deferred path from restoring a paused attribute.
