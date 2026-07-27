import type { AnimationOptions, InitialTarget } from "@transition/cssTypes";
import type { Transition, TransitionVariant, TransitionVariantValue } from "@transition/typing";

// Where an element physically sits before each variant's animation begins.
// Resolved against the variant value table for the same transition, except
// "initial" which reads `transition.initial`. "self" means the variant
// already represents a rest state and no animation is generated. This table
// is the single source of truth for BOTH the CSS keyframes compiler (rest
// rules, park rules) and the rAF transition player (per-frame interpolation).
export const FROM_VARIANT: Record<TransitionVariant, "initial" | TransitionVariant | "self"> = {
  "IDLE-true": "self",
  "IDLE-false": "self",
  "PUSHING-true": "initial",
  "PUSHING-false": "IDLE-true",
  "REPLACING-true": "initial",
  "REPLACING-false": "IDLE-true",
  "POPPING-true": "IDLE-true",
  "POPPING-false": "PUSHING-false",
  "COMPLETED-true": "self",
  "COMPLETED-false": "self"
};

export const TRANSITION_VARIANTS = Object.keys(FROM_VARIANT) as TransitionVariant[];

export type MotionTarget = TransitionVariantValue["value"] | InitialTarget;

// The resolved endpoints and timing of one variant's animation — everything a
// driver (CSS keyframes or the rAF player) needs to reproduce the motion.
export interface VariantMotion {
  from: MotionTarget;
  to: MotionTarget;
  // Seconds, matching the transition definition format.
  duration: number;
  delay: number;
  ease: AnimationOptions["ease"] | undefined;
}

export const variantDuration = (options: AnimationOptions | undefined): number => {
  if (!options) return 0;
  const candidate = (options as { duration?: number }).duration;
  return typeof candidate === "number" && candidate >= 0 ? candidate : 0;
};

export const variantDelay = (options: TransitionVariantValue["options"] | undefined): number => {
  if (!options) return 0;
  return typeof options.delay === "number" && options.delay > 0 ? options.delay : 0;
};

// The `from` target of a variant, or null for rest ("self") variants.
export const resolveVariantFromValue = (
  transitionLike: Pick<Transition, "initial" | "variants">,
  variant: TransitionVariant
): MotionTarget | null => {
  const fromKey = FROM_VARIANT[variant];
  if (fromKey === "self") return null;
  return fromKey === "initial" ? transitionLike.initial : transitionLike.variants[fromKey].value;
};

// Full motion spec for a variant, or null when the variant animates nothing
// (rest variant, or zero duration+delay).
export const resolveVariantMotion = (
  transitionLike: Pick<Transition, "initial" | "variants">,
  variant: TransitionVariant
): VariantMotion | null => {
  const from = resolveVariantFromValue(transitionLike, variant);
  if (from === null) return null;

  const variantValue = transitionLike.variants[variant];
  const duration = variantDuration(variantValue.options);
  const delay = variantDelay(variantValue.options);
  if (duration <= 0 && delay <= 0) return null;

  return {
    from,
    to: variantValue.value,
    duration,
    delay,
    ease: variantValue.options?.ease
  };
};
