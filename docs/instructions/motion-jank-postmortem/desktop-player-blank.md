# Desktop player blank (#256 → #259): instrument before reverting

On `?driver=raf`-pinned desktop Chromium, push→pop→push re-entry left the detail screen completely blank.

PR #256 reverted the pin pierce. This was correct triage because the production default was unaffected, but it treated the player as the defect.

PR #259, merged 2026-08-17, used instrumentation instead of assumption. A frame-by-frame trace showed a correct transition (1280→0, landing inline `none`), followed by blanking one commit later. The root cause was a three-part cleanup interaction:

1. Player-track detach restored the `transform` lease's "original" value. For the actively entered scope, that value is the flemo-rendered entering-initial from-pose, `translate3d(100%,0,0)`, rather than a consumer value.
2. COMPLETED force clear iterates only keys remaining in the lease map; restoration had already removed the transform entry.
3. The empty-map fallback strips transform/opacity only when no other lease survives the flip. On desktop Blink, the governed-easing `animation-timing-function` lease always survives.

Touch sessions worked accidentally because their empty maps triggered the fallback. The shipped fix explicitly strips the scope's pose channels at COMPLETED. With that fix and a desktop-chromium e2e guard, the pin pierce was restored.

## Lessons

1. A clean transition followed by a broken rest state points to the cleanup path, not the driver.
2. "Works on touch" may reflect accidental map contents rather than design.
3. Revert-first is valid triage, but resolve the root cause before restoring the capability.
