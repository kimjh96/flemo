# 2026-08-30: the long-content reveal block (iOS Safari)

A push whose entering screen is longer than the viewport came up **blank below
roughly one tile row** and only filled in near the end of the slide. Reported as
"the pushed page's `overflow: hidden` is released after the transition ends".

It is not overflow, and nothing about it is timing: the flight presents a clean
60fps throughout. It is the pre-raster being paid for and then thrown away.

## What the frames say

Read off a 60fps device recording (iPhone, 1284x2778, iOS Safari), frame by
frame. Times are from the recording's own PTS, which is exactly 16.7ms apart
across the whole flight — **zero dropped frames**.

| frames        | what is on the glass                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 54–57 (67ms)  | the park: the entering screen at its DESTINATION, opacity 0.02. Diffed against frame 53 and amplified 30x, it is the whole new screen — ink from row 24 to row 2777. **The raster is complete, viewport-deep.**                                                                                         |
| 58–66 (150ms) | nothing. The hold has released and the screen sits at its off-screen from-pose.                                                                                                                                                                                                                         |
| 67–77         | the slide, carrying content only down to row 1496 of 2778 — about 512 CSS px, one WebKit tile row. Its BACKGROUND paints the full height (proven: the dimmed leaving screen underneath would otherwise show through, and does not), so this is a paint hole in the scrolled content, not a clipped box. |
| 78            | the rest of the content appears, at unchanged positions — 183ms into the slide, at 86% of the travel.                                                                                                                                                                                                   |

## The mechanism

`park-over` rasterizes the entering screen during the hold, and the release then
leaves it off-screen for `animation-delay` + the governed head — 100ms + 100ms on
PUSHING, because the governed tier shifts the delay by the head as well. WebKit
drops the backing store of a layer that sits outside the coverage rect that long,
keeping about one tile row, and the slide reveals what nobody has rastered.

A screen shorter than one tile row fits inside the survivor, which is why this
only ever reads as a bug on a long one — and why it looks like released overflow
rather than a raster problem.

## The fix

The head holds the PARK pose instead of the from-pose (`PARK_HEAD_ATTR`, the
`-govpark` keyframe copy). The screen stays where its tiles stay live for the
whole wait, then jumps to the from-pose in two slivers that are each invisible
for their own reason — the move happens at the park's opacity, the opacity is
restored off-screen — so no frame can land on a half-parked pose. Verified
against both engines' computed values: the visible curve is the same curve,
started at the same wall-clock moment. `flemo:parkhead=off` is the A/B.

## Two things that were nearly got wrong

- **The park looked dead on the governed tier and is not.** The governed head
  rule out-specifies the park rule (`:root[data-flemo-governed]` plus four
  attributes beats five attributes), so it wins `animation-name` — which reads
  like the park's pose could never apply. It applies anyway: the park's
  `animation: none` shorthand still wins `animation-fill-mode`, and an animation
  with no fill, paused before its delay elapses, contributes nothing. Confirmed
  in real WebKit and Blink rather than argued from specificity.
- **"Background paints, text does not" is the diagnostic.** It separates a paint
  hole from a clipped or short box, and it is only readable because the leaving
  screen is dimmed: sample a point that is inside the entering screen's span AND
  over the dimmed one, below the boundary. Gray means nothing was painted there;
  white means the entering screen painted and only its contents are missing.
