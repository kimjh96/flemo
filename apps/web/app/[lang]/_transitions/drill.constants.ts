// Tuning for going deeper from inside a page (a call to action, a card's
// arrow, a search result), on every screen size: the whole region slides a
// full width and shoves the page it leaves off the other side, both moving
// together as one surface.
//
// An ease-in-out, not the ease-out a single arriving panel would use: the two
// pages travel as one conveyor, so they accelerate from rest and land at rest
// together. It starts moving within the first frames and spreads the peak, so
// a late frame costs a small offset instead of a jump.
export const DRILL_EASE = [0.4, 0, 0.2, 1] as const;

// Back is slightly quicker and shares the curve, so it reads as the same glide
// played in reverse.
export const DRILL_DURATION = 0.52;

export const DRILL_DURATION_BACK = 0.46;
