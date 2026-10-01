# Inline leases

`transition/animateInline.ts` tracks every flemo inline CSS write in a WeakMap as `property → { original, owners: Set<symbol> }`.

- Call `trackInlineWrite(el, property, owner)` before writing. The first lease captures the current inline value as `original`; later writes retain that capture and add owners.
- `clearInlineAnimation(el, properties?, owner?)` restores the captured original instead of deleting it, preserving consumer values such as `animation-delay: 0.2s`. Owner-scoped clearing removes only that owner's stake and restores after the final owner leaves. Ownerless clearing is the force form used by COMPLETED, where the flight is over by definition. Without a property list, it releases all leased properties; if the lease map is empty, it falls back to stripping `transform` and `opacity`.
- Multiple owners are necessary because a swipe settle and an engine flight can co-write shared bars. A single owner would let the first finisher snap the element away from the other. Inline `transition` uses a separate single-value `transitionWriters` tag.

## PR #259 invariant

`enteringInitialStyle` renders flemo's entering `from` pose inline, such as `transform: translate3d(100%,0,0)` for a Cupertino push. Anything leasing `transform` therefore captures a flemo-authored value, not a consumer value.

A teardown restored the `from` pose at COMPLETED and removed its lease entry. A later force clear iterated only the remaining keys; the empty-map fallback did not run if another lease survived. A screen could land at `translateX(100%)`, leaving a blank viewport. Touch worked only because its lease map was empty.

PR #259, merged 2026-08-17, explicitly cleared `transform` and `opacity` after force clearing, allowing the desktop rAF pin again. COMPLETED must explicitly strip pose channels rather than rely on an empty lease map: an original captured from a flemo-rendered inline style is not a consumer value, and compiled rest rules own the landed scope.
