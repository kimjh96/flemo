# 2026-08-30: Long-content reveal block on iOS Safari

During a push, an entering screen longer than the viewport appeared blank below roughly one tile row, then filled near the end of the slide. Although this resembled delayed release of the pushed page's `overflow: hidden`, it was a raster problem, not an overflow or timing defect. The flight maintained 60fps; the completed pre-raster was discarded.

## Frame evidence

A frame-by-frame reading of a 60fps iPhone recording at 1284×2778 found exact 16.7ms PTS intervals throughout the flight and zero dropped frames.

| Frames | Visible result |
| --- | --- |
| 54–57, 67ms | During the park, the entering screen is at its destination with opacity 0.02. A 30× amplified difference from frame 53 shows the complete new screen, with ink from row 24 through row 2777. The viewport-deep raster is complete. |
| 58–66, 150ms | Nothing is visible. The hold has released, leaving the screen at its off-screen from-pose. |
| 67–77 | The slide carries content only through row 1496 of 2778: about 512 CSS px, or one WebKit tile row. Its background paints to full height; otherwise the dimmed leaving screen would show through. This is a paint hole in scrolled content, not a clipped box. |
| 78 | The remaining content appears without changing position, 183ms into the slide at 86% of its travel. |

## Mechanism

`park-over` rasterizes the entering screen during the hold. Release then leaves it off-screen for `animation-delay` plus the governed head: 100ms + 100ms on PUSHING, because the governed tier also shifts the delay by the head. WebKit discards the backing store of a layer outside the coverage rect for that duration, retaining about one tile row. The slide then reveals content that has not been rasterized.

A screen shorter than one tile row fits within the surviving raster, so the defect affects only long screens and resembles released overflow.

## Fix

The head holds the PARK pose instead of the from-pose, using `PARK_HEAD_ATTR` and a `-govpark` / `-deskpark` keyframe copy. This keeps the screen where its tiles remain live throughout the wait. It then jumps to the from-pose in slivers concealed for separate reasons: movement occurs at park opacity, and concealment is released only after the screen is hidden. No frame can show a half-parked pose.

Computed values were verified in WebKit and Blink: the visible curve is unchanged and begins at the same wall-clock time. Use `flemo:parkhead=off` for the A/B comparison.

## Implementation rule

The initial fix duplicated the park conditions, and the lists immediately diverged. It required an entering, active push-or-replace variant that did not animate opacity. This excluded every opacity-authored transition: `layout`, used by the shared-element bench, parked and then discarded the park, while `cupertino` did not. Preset-by-preset testing would therefore have reported success incorrectly.

The rule names neither transitions nor variants:

> Wherever the engine parks a screen to pre-rasterize it, the head that follows keeps the screen where the park put it.

Compute the park decision once (`parkable` / `parksCovered` / `parksEntering`) and derive every park-shaped rule, including heads, from it. Consumers may author transitions that hide a screen using a translate, opacity, scale, or anything `targetHidesScreen` recognizes later; both halves must answer identically for every authored shape. Test this congruence across authored shapes, not presets.

Concealment varies by side because it must survive release, whereas the hold did not:

| Hold | Concealed by | Survives release |
| --- | --- | --- |
| `park-over` | Its own near-zero opacity | Yes: opacity travels with the animation. |
| `park` (covered) | The screen moving over it, held on the same clock | Yes: that screen is in its own head. |
| `park-under` | A z-index the binding drops at release | No. |

The binding writes the attribute only for the two concealments that survive, so the compiler need not know which tier selected which park.

## Releasing concealment

Releasing concealment is not always setting opacity to 1. WebKit caught the initial emitter forcing `opacity: 1` at concealment's end. That is correct only when the transition declares no opacity.

For `layout`, this made the screen fully opaque on the frame after the head—measured at 1.00 when the authored curve was 0.20—and removed the fade the head was meant to protect. When the author animates opacity, release means stopping the concealment so authored values take over from the from-pose onward. Spell out the release only for a transition that declares no opacity.

## Diagnostic cautions

- The park remains active on the governed tier despite appearing overridden. The governed head rule, with `:root[data-flemo-governed]` plus four attributes, outranks the park rule with five attributes and wins `animation-name`. The park pose still applies because its `animation: none` shorthand wins `animation-fill-mode`; an animation with no fill, paused before its delay elapses, contributes nothing. This behavior was confirmed in real WebKit and Blink rather than inferred from specificity alone.
- “Background paints, text does not” identifies a paint hole rather than a clipped or undersized box. Use the dimmed leaving screen to test it: sample below the boundary at a point within the entering screen's span and over the dimmed screen. Gray means nothing painted there; white means the entering screen's background painted while its contents are missing.
