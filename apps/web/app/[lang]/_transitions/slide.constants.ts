// Shared tuning for the full-page "shove" slides: the playground's vertical
// shove (pageShove) and the docs' horizontal shove (docsEnter). One curve and
// one pair of durations so the two read as the same motion on different axes.
//
// The curve is an ease-in-out, not the ease-out a single arriving panel would
// use. Both pages translate together like a conveyor, so it should accelerate
// from rest and decelerate to rest as one object. A plain ease-out launches the
// whole pair at full velocity (a visible snap) before gliding to a stop; this
// eases gently out of rest and lands softly, which is what reads as smooth.
// Softened from [0.6, 0, 0.2, 1]: that curve sat nearly still for the first
// ~100ms and then crossed half the screen in the next 100ms. Concentrating the
// velocity like that is fragile — any single late frame (the occasional raster
// lag while a heavy page is being revealed) lands in the fast window and reads
// as a visible hitch, and the still-then-lunge profile itself reads as
// hesitation right after a click. This curve keeps the conveyor's
// accelerate-from-rest character but starts moving within the first frames and
// spreads the peak (max ~36px/frame vs ~41), so a late frame costs a small
// offset instead of a jump.
export const SLIDE_EASE = [0.4, 0, 0.2, 1] as const;

// Forward navigation (a page enters while its peer exits) and the slightly
// quicker back navigation. Both share the curve, so back feels like the same
// glide played in reverse.
export const SLIDE_DURATION = 0.52;
export const SLIDE_DURATION_BACK = 0.46;
