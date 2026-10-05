import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";
import type { BaseTransition, SwipeAnimate, TransitionVariant } from "@transition/typing";

// A part's variant: a POSE, and optionally a clock.
//
// Omitting `duration` runs this variant on the SCREEN's own duration for the
// same variant key (resolvePartTiming) — the number an author matching a piece
// of bar chrome to its transition was writing out by hand, and the number that
// used to resolve to ZERO when they did not: the part snapped while the screen
// carrying it took three quarters of a second, and a part authored LONGER than
// its screen held the whole transition open, which disables swipe-back for as long
// as it runs.
//
// `ease` is NOT inherited, for the reason stated on DecoratorVariantValue:
// timing says WHEN a part runs; the curve is still the part author's to draw.
//
// An explicit `duration` still wins, including `0` for a piece that should
// snap and a span longer than the screen's for chrome meant to outlive it.
/**
 * A part's own animation options: the screen's, plus one thing a screen cannot
 * express for it.
 *
 * `after: "transition"` starts the part after the screen transition ENDS. A part
 * that is covered for the length of a transition and revealed when it ends has
 * to wait exactly that long, and the length belongs to whichever transition the
 * part is moving with, which the part does not know and must not be made to know.
 * Before this the only way to write it was a literal, so a consumer's header
 * needed one part per transition and a table of their durations: this
 * repository's own playground had eight rows, and a transition with no row
 * simply had no part at all.
 *
 * `delay` still means what it means, and composes: `{ after: "transition", delay:
 * 0.04 }` is four hundredths of a second after the transition ends.
 */
export type PartVariantOptions = AnimationOptions & {
  after?: "transition";
};

export type PartVariantValue = {
  value: TransitionTarget;
  options?: PartVariantOptions;
};

// User-augmentable registry of part-transition names, mirroring RegisterRoute /
// RegisterDecorator. A binding (or the consumer) augments this to get typed
// `name` strings on `createPartTransition` and `<Part name="...">`.
// eslint-disable-next-line
export interface RegisterPartTransition {}

export type PartTransitionName =
  RegisterPartTransition[keyof RegisterPartTransition] | (string & {});

/**
 * Advanced per-element overrides for the interactive pop path.
 *
 * A Part with no callback here already follows the transition's swipe by
 * scrubbing its declared `POPPING` variant and resolved timing. Adding any one
 * of these callbacks stops that Part element from following the swipe by
 * default, so the callbacks become solely responsible for its style during the
 * drag and for both outcomes when the finger lifts. Use them only when the gesture needs a different shape from the
 * declared programmatic pop.
 */
export type PartTransitionOptions = {
  /** Starts custom control for this Part element. */
  onSwipeStart?: (
    triggered: boolean,
    options: { animate: SwipeAnimate; element: HTMLElement; active: boolean }
  ) => void;
  /** Writes the custom drag style from progress in the range 0 through 100. */
  onSwipe?: (
    triggered: boolean,
    progress: number,
    options: { animate: SwipeAnimate; element: HTMLElement; active: boolean }
  ) => void;
  /** Finishes the custom style; `triggered` reports whether the swipe goes back (true) or is cancelled (false). */
  onSwipeEnd?: (
    triggered: boolean,
    options: { animate: SwipeAnimate; element: HTMLElement; active: boolean }
  ) => void;
};

// A part-transition is shaped exactly like a decorator's transition (status×active
// variants + swipe hooks); it differs only in how it's used — referenced by name
// on a `<PartTransition>` child element, not bound to a screen transition.
export interface PartTransition
  extends Omit<BaseTransition, "name" | "variants">, PartTransitionOptions {
  name: PartTransitionName;
  variants: Record<TransitionVariant, PartVariantValue>;
}
