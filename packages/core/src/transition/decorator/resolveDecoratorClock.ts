import type { BaseTransition, Transition, TransitionVariant } from "@transition/typing";

import { TRANSITION_VARIANTS, variantDelay, variantDuration } from "@transition/variantMotion";

import type { Decorator } from "@transition/decorator/typing";

/**
 * A decorator's variant table with its clock filled in from the screen
 * transition that names it.
 *
 * A decorator is only ever reached through `transition.decoratorName`, so the
 * flight it dresses already decides how long it has. Authoring the length a
 * second time is how the two drift apart, and this repository worked around
 * that three times before removing the duplication:
 *
 *   - `overlay` and `cupertino` each restated 0.7s, with a comment on the
 *     decorator saying the number came from the transition.
 *   - the playground's `drift` and `recess` share a constants file for no
 *     other reason than to keep two hand-written clocks equal.
 *   - `layout` dropped its dim ALTOGETHER rather than inherit `overlay`'s
 *     0.7s over a 0.4s flight: measured on a pop, the dismissing screen was
 *     fully gone at 335ms while the screen underneath still carried a 10%
 *     black wash, which reads as a grey cast appearing from nowhere and then
 *     lifting for no reason.
 *
 * The rule is the SAME VARIANT KEY, which is exactly the mapping those
 * workarounds were doing by hand: a decorator's `enter` sits at PUSHING-false
 * with the screen's `exit`, its `exit` at POPPING-false with the screen's
 * `exitBack`. It therefore also carries direction for free — a preset whose
 * push and pop differ (material runs 0.35s and 0.25s) gives its dim the same
 * asymmetry without the author restating it.
 *
 * THE CURVE IS NOT PART OF THIS, and that is a decision rather than an
 * omission. A `<Part>` now takes the screen's curve when it names none, because
 * a part's pose is a place ON the screen and the two have to agree there. A
 * decorator has no such place: it dims. `overlay` records what happens if the
 * two rules are collapsed into one — cupertino's positional decelerate curve
 * front-loads a luminance ramp into an abrupt step with a long invisible tail,
 * against a decorator designed for an even perceived ramp. So the length is
 * inherited, the curve is authored, and a decorator that wants the screen's
 * curve writes it.
 *
 * Resolution is COMPILE TIME and produces a literal. It must never become a
 * `var()` in `animation-duration`: timing that depended on custom properties
 * lost WebKit's accelerated playback and collapsed to a 2-frame snap under
 * main-thread starvation (device-bisected 2026-08-13, see
 * compileTransitionStyles.ts).
 */
export const resolveDecoratorClock = (
  transition: Pick<Transition, "variants">,
  decorator: Pick<Decorator, "initial" | "variants">
): Pick<BaseTransition, "initial" | "variants"> => {
  const variants = {} as BaseTransition["variants"];

  for (const variant of TRANSITION_VARIANTS as TransitionVariant[]) {
    const authored = decorator.variants[variant];
    const screen = transition.variants[variant];

    variants[variant] = {
      value: authored.value,
      options: {
        ...authored.options,
        // `??`, not `||`: an authored `0` is a snap the author asked for, and
        // it has to survive a screen that runs for three quarters of a second.
        duration: authored.options?.duration ?? variantDuration(screen.options),
        delay: authored.options?.delay ?? variantDelay(screen.options)
      }
    };
  }

  return { initial: decorator.initial, variants };
};

export default resolveDecoratorClock;
