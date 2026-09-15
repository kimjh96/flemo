# Screen and freeze

`Screen.tsx` composes `ScreenFreeze` and `ScreenMotion`, calculating freeze through core's `computeScreenFreeze(Mode)`.

`ScreenFreeze` uses React `<Activity>`. Hidden mode preserves DOM, scroll, and state but unmounts effects. A deeply covered screen's COMPLETED effect therefore never runs; flight teardown performs cleanup instead. Mount effects rerun on every unfreeze, which `eagerlyDecodeImages` relies on.

The direct previous screen differs: freezing is deferred by `FREEZE_DEFER_MS` (600ms), keeping it live across convergence. The device A/B measured approximately 0.2 dropped frames per flight over 117 flights. On desktop Blink, `ScreenFreeze` further debounces hiding by 3s so a quick detail-and-back avoids hide/unhide raster thrash.

Activity hiding disconnects `ScreenMotion` layout effects, so shared-bar cleanup unregisters the entry. State and measurement refs survive. Unfreeze registration republishes the complete ID and height before the observer reconnects. Do not move measurement solely into an effect or restore a registry window containing identity without height.
