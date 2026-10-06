# Inline leases

`transition/animateInline.ts` tracks every flemo inline CSS write in a WeakMap as `property → { original, owners: Set<symbol> }`.

- Call `trackInlineWrite(el, property, owner)` before writing. The first lease captures the current inline value as `original`; later writes retain it and add owners.
- `clearInlineAnimation(el, properties?, owner?)` restores the captured original, preserving consumer values such as `animation-delay: 0.2s`. Owner-scoped clearing removes only that owner's stake and restores after the final owner leaves. Ownerless clearing forces release and is used by COMPLETED, when the transition is over by definition. Without a property list, clearing releases all leased properties; an empty lease map triggers fallback stripping of `transform` and `opacity`.
- Multiple owners allow a swipe settle and an engine transition to co-write shared bars. With one owner, the first finisher could snap the element away from the other. Inline `transition` uses a separate single-value `transitionWriters` tag.

## PR #259 invariant

`enteringInitialStyle` renders flemo's entering `from` pose inline, such as `transform: translate3d(100%,0,0)` for a Cupertino push. A `transform` lease therefore captures a flemo-authored value rather than a consumer value.

A teardown restored the `from` pose at COMPLETED and removed its lease entry. A later force clear iterated only remaining keys; if another lease survived, the empty-map fallback did not run. A screen could land at `translateX(100%)`, leaving a blank viewport. Touch worked only because its lease map was empty.

PR #259, merged 2026-08-17, explicitly cleared `transform` and `opacity` after force clearing, allowing the desktop rAF pin again. COMPLETED must explicitly strip pose channels rather than rely on an empty lease map: an original captured from a flemo-rendered inline style is not a consumer value, and compiled rest rules own the landed scope.
