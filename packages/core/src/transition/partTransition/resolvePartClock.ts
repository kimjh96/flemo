import type { BaseTransition, Transition, TransitionVariant } from "@transition/typing";

import { TRANSITION_VARIANTS, variantDelay, variantDuration } from "@transition/variantMotion";

import type { PartTransition } from "@transition/partTransition/typing";

/**
 * A part's variant table with its clock filled in from the screen transition
 * carrying the flight.
 *
 * A `<Part>` declares a POSE: what the piece of chrome looks like on each side
 * of a hand-over. How long it takes to get there is not its own question — it
 * is the flight's, and the flight already answered it. Authoring the length a
 * second time is how the two drift apart, and an omitted length was worse than
 * drift: it resolved to zero and the part SNAPPED while the screen carrying it
 * took three quarters of a second.
 *
 * This is the rule `resolveDecoratorClock` already applies to decorators, for
 * the same reason and by the same mapping: the SAME VARIANT KEY. A part's
 * PUSHING-false sits with the screen's PUSHING-false, so a preset whose push
 * and pop differ (material runs 0.35s and 0.25s) gives its parts the same
 * asymmetry without the author restating it.
 *
 * WHERE IT DIFFERS from a decorator, and why this could not simply reuse it: a
 * decorator is reached through `transition.decoratorName`, so it belongs to one
 * transition and can be resolved once. A part is referenced by NAME and may
 * appear under any transition in the Router, so the pair is resolved per
 * transition and the compiled rule carries a `data-flemo-transition` term to
 * select the right one. A part mounted outside any screen has no transition to
 * inherit from and keeps what it authored.
 *
 * `transition` is null where there is no flight to inherit from — the by-name
 * pass, and a part mounted outside any screen. It then normalizes rather than
 * inherits: every variant comes back with a clock, so nothing downstream has to
 * carry the optional shape. That normalization is the reason PartVariantValue's
 * looseness stops here, exactly as DecoratorVariantValue's does.
 *
 * Resolution is COMPILE TIME and produces a literal. It must never become a
 * `var()` in `animation-duration`: timing that depended on custom properties
 * lost WebKit's accelerated playback and collapsed to a 2-frame snap under
 * main-thread starvation (device-bisected 2026-08-13, see
 * compileTransitionStyles.ts).
 */
export const resolvePartClock = (
  transition: Pick<Transition, "variants"> | null,
  part: Pick<PartTransition, "initial" | "variants">
): Pick<BaseTransition, "initial" | "variants"> => {
  const variants = {} as BaseTransition["variants"];

  for (const variant of TRANSITION_VARIANTS as TransitionVariant[]) {
    const authored = part.variants[variant];
    const screen = transition?.variants[variant];

    variants[variant] = {
      value: authored.value,
      options: {
        ...authored.options,
        // `??`, not `||`: an authored `0` is a snap the author asked for, and
        // it has to survive a screen that runs for three quarters of a second.
        duration: authored.options?.duration ?? variantDuration(screen?.options),
        delay: authored.options?.delay ?? variantDelay(screen?.options)
      }
    };
  }

  return { initial: part.initial, variants };
};

export default resolvePartClock;
