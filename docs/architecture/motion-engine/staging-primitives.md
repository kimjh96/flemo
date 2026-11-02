# Shared staging geometry and animation clocks

`packages/core/src/dom/staging.ts` provides coordinate conversion and CSS animation clock preservation for morph and shared-bar Part staging. It lives in `dom` because morph already imports the engine; engine staging must not introduce a reverse dependency into morph.

- [Layer coordinates](staging-primitives/layer-coordinates.md): axis-wise coordinate conversion and tolerance.
- [Animation clocks](staging-primitives/animation-clocks.md): matching, restoration, snapshot lifetime, and cost.

See [shared-bar staging and swipe lifecycle](staging-and-swipe.md) for the Part caller's ownership and cleanup.
