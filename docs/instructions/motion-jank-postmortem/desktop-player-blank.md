# (d) Worked example: the desktop player blank (#256 → #259) — instrument before you revert

Symptom: on `?driver=raf`-pinned desktop Chromium, push→pop→push re-entry left the detail screen completely blank.

First response (PR #256) *reverted the pin pierce* — correct triage, since the production default was never affected, but it treated the player as the defect.

PR #259 (merged 2026-08-17) instrumented instead of assuming: a frame-by-frame trace showed the flight drove perfectly (1280→0, landing inline `none`) and the screen blanked ONE COMMIT LATER. Root cause was a three-part cleanup interaction, not a player bug:

1. The player track's detach restored its `transform` lease "original" — which, for the actively-entered scope, is the **flemo-rendered entering-initial from-pose** (`translate3d(100%,0,0)`), not a consumer value.
2. The COMPLETED force clear iterates only keys still in the lease map, and the restore had just dropped the transform entry.
3. The empty-map fallback that strips transform/opacity never runs while any other lease survives the flip — and on desktop Blink the governed-easing `animation-timing-function` lease always does.

Touch sessions were saved by accident (empty map → fallback). The shipped fix strips the scope's pose channels explicitly at COMPLETED, and the pin pierce was restored on the strength of it, with a desktop-chromium e2e guard.

Lessons:

1. A clean flight plus a broken rest state means look at the CLEANUP path, not the driver.
2. "Works on touch" can be an accident of map contents, not a design.
3. Revert-first is fine for triage, but the root cause must be paid down before the capability returns.
