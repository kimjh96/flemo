# 2026-08-30: the long-content reveal block on iOS Safari

During a push, an entering screen longer than the viewport appeared blank below roughly one tile row and filled in only near the end of the slide. The report described it as the pushed page's `overflow: hidden` being released after the transition.

It was not an overflow or timing defect. The flight maintained a clean 60fps; the pre-raster was completed and then discarded.

## Frame evidence

A frame-by-frame reading of a 60fps iPhone recording at 1284×2778 showed PTS intervals of exactly 16.7ms throughout the flight, with zero dropped frames.

| Frames | Visible result |
| --- | --- |
| 54–57, 67ms | During the park, the entering screen is at its destination with opacity 0.02. A 30× amplified difference from frame 53 shows the complete new screen, with ink from row 24 through row 2777. The viewport-deep raster is complete. |
| 58–66, 150ms | Nothing is visible. The hold has released, leaving the screen at its off-screen from-pose. |
| 67–77 | The slide carries content only through row 1496 of 2778, about 512 CSS px or one WebKit tile row. Its background paints to full height: otherwise the dimmed leaving screen would show through, but it does not. This is therefore a paint hole in scrolled content, not a clipped box. |
| 78 | The remaining content appears without changing position, 183ms into the slide at 86% of its travel. |

## Mechanism

`park-over` rasterizes the entering screen during the hold. Release then leaves it off-screen for `animation-delay` plus the governed head: 100ms + 100ms on PUSHING, because the governed tier also shifts the delay by the head. WebKit discards the backing store of a layer outside the coverage rect for that duration, retaining about one tile row. The subsequent slide reveals content that has not been rasterized.

A screen shorter than one tile row fits inside the surviving raster. The defect therefore appears only with long screens and resembles released overflow rather than a raster problem.

## Fix

The head now holds the PARK pose instead of the from-pose, using `PARK_HEAD_ATTR` and the `-govpark` keyframe copy. This keeps the screen where its tiles remain live throughout the wait. It then jumps to the from-pose in two slivers, each invisible for a separate reason: the movement occurs at park opacity, and opacity is restored while the screen is off-screen. No frame can show a half-parked pose.

Computed values were verified in both engines: the visible curve is unchanged and begins at the same wall-clock time. Use `flemo:parkhead=off` for the A/B comparison.

## Diagnostic cautions

- **The park is active on the governed tier despite appearing overridden.** The governed head rule, with `:root[data-flemo-governed]` plus four attributes, outranks the park rule with five attributes and therefore wins `animation-name`. The park pose still applies because its `animation: none` shorthand wins `animation-fill-mode`; an animation with no fill that is paused before its delay elapses contributes nothing. This was confirmed in real WebKit and Blink rather than inferred from specificity alone.
- **“Background paints, text does not” identifies the failure.** It distinguishes a paint hole from a clipped or undersized box. The dimmed leaving screen makes the test readable: sample below the boundary at a point inside the entering screen's span and over the dimmed screen. Gray means nothing painted there; white means the entering screen's background painted while only its contents are missing.
