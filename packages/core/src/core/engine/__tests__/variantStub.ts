import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";
import type { Transition } from "@transition/typing";

import { TRANSITION_VARIANTS } from "@transition/variantMotion";

/**
 * A full status x active variant table for a hand-built `Transition` stub.
 *
 * Every swipe-controller suite used to write `variants: {}` behind an
 * `as unknown as Transition`, which typechecked because the cast said so and
 * ran because nothing read the table. Two things read it now: the drag layer
 * hold folds a transition's clock into its decorator's, and the release reads
 * the pop variant for the ceiling the decorator borrows. A partial table is a
 * shape no real `Transition` can have, so the stubs carry all ten keys.
 */
export const fullVariants = (value: TransitionTarget, options?: AnimationOptions) =>
  Object.fromEntries(
    TRANSITION_VARIANTS.map((variant) => [variant, { value, options }])
  ) as Transition["variants"];
