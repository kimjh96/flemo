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

    // AFTER THE FLIGHT, which is the one length a part cannot write down.
    //
    // A part covered for a flight and revealed at its landing waits exactly as
    // long as the flight, and that length belongs to whichever transition is
    // carrying it. Written as a literal it is one part per transition plus a
    // table of their durations, which is what this repository's own playground
    // had: eight rows, and a consumer's own transition got no part at all.
    const flightSpan = variantDelay(screen?.options) + variantDuration(screen?.options);
    const after = authored.options?.after === "flight";

    variants[variant] = {
      value: authored.value,
      options: {
        ...authored.options,
        // `??`, not `||`: an authored `0` is a snap the author asked for, and
        // it has to survive a screen that runs for three quarters of a second.
        duration: authored.options?.duration ?? variantDuration(screen?.options),
        delay: after
          ? flightSpan + (authored.options?.delay ?? 0)
          : (authored.options?.delay ?? variantDelay(screen?.options)),
        // THE CURVE IS THE SCREEN'S TOO, and for a sharper reason than the
        // length.
        //
        // A part's pose is a place ON the screen carrying it, so the eye reads
        // the two together for the whole flight. Sharing the length but not the
        // curve puts them at the same clock and different places: measured with
        // this package's own sampler, a part left on the CSS default under
        // cupertino's `[0.32, 0.72, 0, 1]` is 37.5 percentage points behind its
        // screen at 161ms of a 0.7s flight, which is 27px of a 72px title.
        //
        // It is also what made a swipe look like a different transition from
        // the pop it walks. A drag is position-controlled: `scrubTo` seeks each
        // rider through the INVERSE of its own curve, so under the finger the
        // curve cancels and every rider sits at the same fraction of its
        // travel. The flight has no such cancellation. Two curves therefore
        // agree under a finger and disagree in the air, and the same
        // hand-over read as two different motions depending on how it started.
        //
        // This is the rule `attachMorph` already applies to a shared element,
        // for the same reason and with device measurements behind it: a
        // destination riding a moving screen chased on a second clock never
        // closes monotonically.
        //
        // WHAT DOES NOT INHERIT is a decorator's, and that is a decision about
        // what is being animated rather than an omission here: a dim is a
        // luminance channel with no place on the screen to agree with, and a
        // positional curve front-loads it into a step (see `overlay.ts`). A
        // part whose only channel is luminance should name its own curve for
        // the same reason.
        ease: authored.options?.ease ?? screen?.options?.ease
      }
    };
  }

  return { initial: part.initial, variants };
};

export default resolvePartClock;
