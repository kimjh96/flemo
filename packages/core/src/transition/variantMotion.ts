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

// Mean translation speed of a motion in CSS px per 60Hz frame, with % values
// resolved against the given base box. Screen slides move ~12px/frame at
// their peak; tab fades drift under 1px/frame. The number feeds the
// per-motion driver gate: the rAF player's device-pixel-snapped writes
// shiver near rest on fast motion (measured: presented frames alternate
// hold/1px-step), so real slides stay on the compiled path everywhere, while
// low-displacement motion may ride the player where it is the default.
// Unparseable string values (template motion) count as no displacement —
// they are not translations.
const translationPx = (raw: unknown, basePx: number): number => {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const match = /^(-?\d*\.?\d+)(px|%)?$/.exec(raw.trim());
  if (!match) return 0;
  const value = parseFloat(match[1]!);
  return match[2] === "%" ? (value / 100) * basePx : value;
};

export const motionTranslationPxPerFrame = (
  motion: VariantMotion,
  base: { width: number; height: number }
): number => {
  const axisDistance = (prop: "x" | "y", basePx: number) => {
    const from = translationPx((motion.from as Record<string, unknown>)?.[prop], basePx);
    const to = translationPx((motion.to as Record<string, unknown>)?.[prop], basePx);
    return Math.abs(to - from);
  };
  const distance = Math.max(axisDistance("x", base.width), axisDistance("y", base.height));
  const frames = Math.max(1, motion.duration * 60);
  return distance / frames;
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
