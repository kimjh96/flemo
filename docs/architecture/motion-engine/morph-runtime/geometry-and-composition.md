# Timing, geometry, and nested composition

These contracts describe the supplied `packages/core/src/morph/attachMorph.ts`; see the [assessment scope and references](../morph-runtime.md).

## Timing

A top-level run uses authored duration when supplied, otherwise the resolved screen duration. A nonpositive result falls back to 0.4 seconds. A moving screen's easing takes precedence so the morph follows its moving destination; otherwise the morph's authored easing takes precedence over the screen's easing. Delay includes the routing head. A nested run inherits its carrier's duration, easing, start, and head.

## Geometry and synchronization

Two decisions govern geometry and its followers:

- `travelPinned = ensurePinnedPoses()` is passed to arrival and nested keyframe builders to request registered-property geometry. The source describes a left/top fallback when registration is unavailable.
- After building the arrival, `pinned = !arriving.geometryAccelerated && ensurePinnedPoses()` determines whether follower poses must track nonaccelerated geometry. It is passed to ghost and nested keyframe construction; the camera receives `accelerated: !pinned`.

The arrival builder's geometry verdict therefore governs follower synchronization; the caller does not force every morph onto one rendering path. Source comments explain that independently accelerated ghost or camera transforms can advance while layout-driven geometry stalls. Helper implementations and actual browser scheduling are outside this assessment.

The caller computes typography channels for font size, weight, letter spacing, word spacing, and line height, and requests leading and tracking corrections from helpers. Paint channels come from the paint helper. Pixel corner values become proportions only when both boxes are within 10 percent of square and both corner lists parse as pixel lengths. Percentage corners disable the contents-hold request. Reveal eligibility, content stability, image handling, shadow output, and emitted keyframes depend on imported helpers.

## Nested composition

An enclosing Morph delays evaluation by one microtask so child-first registration can allow the container to start first. With a live enclosing run, the child stays inside it and inherits its clock. The child can correct its initial position, typography, aspect ratio, spacing, paint, and non-text size. Size interpolation ends at the cached rest size when available, rather than the size measured inside an already staged container. With no relevant changes, the nested branch returns without creating a run.

Nested runs restore their captured inline style and clear their role when they finish. They have their own geometry-end listener and backstop and appear in the scope's transition map.
