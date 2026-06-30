// Shared tuning for the full-page "shove" slides: the playground's vertical
// shove (pageShove) and the docs' horizontal shove (docsEnter). One curve and
// one pair of durations so the two read as the same motion on different axes.
//
// The curve is an ease-in-out, not the ease-out a single arriving panel would
// use. Both pages translate together like a conveyor, so it should accelerate
// from rest and decelerate to rest as one object. A plain ease-out launches the
// whole pair at full velocity (a visible snap) before gliding to a stop; this
// eases gently out of rest and lands softly, which is what reads as smooth.
export const SLIDE_EASE = [0.6, 0, 0.2, 1] as const;

// Forward navigation (a page enters while its peer exits) and the slightly
// quicker back navigation. Both share the curve, so back feels like the same
// glide played in reverse.
export const SLIDE_DURATION = 0.52;
export const SLIDE_DURATION_BACK = 0.46;
