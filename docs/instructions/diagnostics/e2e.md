# E2E diagnostics helpers

Helpers and tests live in `apps/web/e2e/`.

- `helpers/flemo.ts` provides `activeScreen` and `allScreens` for `data-flemo-*` locators; `waitForNavIdle(page)`, which waits until no screen is PUSHING, POPPING, or REPLACING, then adds a 150 ms grace period; and `trackConsoleErrors`, which filters network 404 noise.
- `swipe-release.spec.ts` and `swipe-declared.spec.ts` drive a real pointer against compiled CSS and inspect the screens and dim. They catch defects unit tests cannot see: relationships between two elements' computed styles at one instant of a gesture, and whether an engine walks the keyframes assembled by a declaration.
- Bound a landing by its own travel, not a fraction of the box. A rAF sampler on a slow runner captures the same transition in larger pieces, so a pixel bound measures the runner. This mistake failed a probe twice on CI despite fourteen consecutive local passes.
- Prove a probe fails before trusting it. Forcing `swipeSettleSeconds` to return 0 turns every release into a cut—the defect the flick case claims to catch.
- `morph-first-frame.spec.ts` covers the morph's opening frame; `devtools-production.spec.ts` verifies that the devtools import is inert in a production bundle.

CI runs `--project=chromium --project=mobile-chromium`. Run both locally: running only one can let a desktop-only failure reach CI unseen.
