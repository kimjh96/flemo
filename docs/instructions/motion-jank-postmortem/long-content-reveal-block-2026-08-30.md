# 2026-08-30: Long-content reveal block on iOS Safari

During a push, an entering screen longer than the viewport appeared blank below roughly one tile row, then filled near the slide's end. This resembled delayed release of the pushed page's `overflow: hidden`, but the cause was discarded pre-raster: the transition maintained 60fps.

## Frame evidence

Frame-by-frame analysis of a 60fps iPhone recording at 1284×2778 found exact 16.7ms PTS intervals and no dropped frames throughout the transition.

| Frames | Evidence |
| --- | --- |
| 54–57, 67ms | During the park, the entering screen is at its destination with opacity 0.02. A 30× amplified difference from frame 53 shows the complete new screen, with ink from row 24 through row 2777: the viewport-deep raster is complete. |
| 58–66, 150ms | Nothing is visible. The hold has released, leaving the screen at its off-screen from-pose. |
| 67–77 | The slide carries content only through row 1496 of 2778: about 512 CSS px, or one WebKit tile row. The background paints to full height; otherwise the dimmed leaving screen would show through. This is a paint hole in scrolled content, not a clipped box. |
| 78 | Remaining content appears without changing position, 183ms into the slide at 86% of its travel. |

## Mechanism

`park-over` rasterizes the entering screen during the hold. Release leaves it off-screen for `animation-delay` plus the governed head: 100ms + 100ms on PUSHING, because the governed tier also shifts the delay by the head. WebKit discards the backing store of a layer outside the coverage rect for that duration, retaining about one tile row. The slide then reveals content that is no longer rasterized.

Screens shorter than one tile row fit inside the surviving raster. Only long screens exhibit the defect, which resembles released overflow.

## Fix

The head holds the PARK pose instead of the from-pose, using `PARK_HEAD_ATTR` and a `-govpark` / `-deskpark` keyframe copy. This keeps tiles live throughout the wait. It then jumps to the from-pose while concealed: movement occurs at park opacity, and concealment releases only after the screen is hidden. No frame can show a half-parked pose.

WebKit and Blink verification showed that the visible curve remains unchanged and starts at the same wall-clock time. Use `flemo:parkhead=off` for A/B comparison.

## Implementation rule

The initial fix duplicated park conditions, and the lists immediately diverged. It required an entering, active push-or-replace variant that did not animate opacity, excluding every opacity-authored transition. `layout`, used by the shared-element bench, parked and then discarded the park; `cupertino` did not. Preset-by-preset testing could therefore incorrectly report success.

> Wherever the engine parks a screen to pre-rasterize it, the head that follows keeps the screen where the park put it.

Compute the park decision once (`parkable` / `parksCovered` / `parksEntering`) and derive every park-shaped rule, including heads, from it. Consumers may hide a screen with translate, opacity, scale, or anything `targetHidesScreen` recognizes later. Both halves must answer identically for every authored shape. Test congruence across authored shapes, not presets.

Concealment differs by side because it must survive release; the hold did not need to:

| Hold | Concealed by | Survives release |
| --- | --- | --- |
| `park-over` | Its own near-zero opacity | Yes: opacity travels with the animation. |
| `park` (covered) | The screen moving over it, held on the same clock | Yes: that screen is in its own head. |
| `park-under` | A z-index the binding drops at release | No. |

The binding writes the attribute only for the two concealments that survive. The compiler need not know which tier selected each park.

## Releasing concealment

Release does not always mean setting opacity to 1. WebKit caught the initial emitter forcing `opacity: 1` at concealment's end, which is correct only when the transition declares no opacity.

For `layout`, this made the screen fully opaque on the frame after the head: measured opacity was 1.00 when the authored curve was 0.20. It removed the fade the head protected. When the author animates opacity, release means stopping concealment so authored values take over from the from-pose onward. Spell out the release only when the transition declares no opacity.

## Diagnostic cautions

- The park remains active on the governed tier despite appearing overridden. The governed head rule, with `:root[data-flemo-governed]` plus four attributes, outranks the park rule with five attributes and wins `animation-name`. The park pose still applies because its `animation: none` shorthand wins `animation-fill-mode`: an animation with no fill, paused before its delay elapses, contributes nothing. Real WebKit and Blink confirmed this; specificity alone did not establish it.
- “Background paints, text does not” identifies a paint hole rather than a clipped or undersized box. Test with the dimmed leaving screen: sample below the boundary within the entering screen's span and over the dimmed screen. Gray means nothing painted there; white means the entering screen's background painted while its contents are missing.
