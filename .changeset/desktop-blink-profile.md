---
"@flemo/core": minor
"@flemo/react": patch
---

Key the two desktop defaults that are not about refresh rate on the desktop
itself. The screen-scope layer promotion and `ScreenFreeze`'s hide debounce now
read a new `isDesktopBlink` predicate instead of the learned steady-60 verdict:
one is about how Blink treats an occluded layer, the other trades memory for
raster, and neither reads the display. Desktop Chrome sessions get both from
their first flight instead of after a two-flight cadence measurement, and a
120Hz or 1x desktop is no longer excluded from defaults that never depended on
its panel.
