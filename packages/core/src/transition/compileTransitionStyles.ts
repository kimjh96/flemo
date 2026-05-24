import type { AnimationOptions, InitialTarget } from "@transition/cssTypes";
import type { Transition, TransitionVariant, TransitionVariantValue } from "@transition/typing";

import type { Decorator } from "@transition/decorator/typing";

// Where the screen physically sits before each variant's animation begins.
// Resolved against the variant value table for the same transition, except
// "initial" which reads `transition.initial`. "self" means the variant
// already represents a rest state and no animation is generated.
const FROM_VARIANT: Record<TransitionVariant, "initial" | TransitionVariant | "self"> = {
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

const TRANSITION_VARIANTS = Object.keys(FROM_VARIANT) as TransitionVariant[];

const DECORATOR_VARIANTS = TRANSITION_VARIANTS;

const cssIdentifier = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, "_");

const isPlainObject = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const numberToPx = (value: number, prop: string) => {
  if (prop === "opacity" || prop === "scale" || prop === "scaleX" || prop === "scaleY") {
    return `${value}`;
  }
  if (prop === "rotate" || prop === "rotateX" || prop === "rotateY" || prop === "rotateZ") {
    return `${value}deg`;
  }
  return `${value}px`;
};

const formatValue = (prop: string, value: unknown): string => {
  if (typeof value === "number") return numberToPx(value, prop);
  if (typeof value === "string") return value;
  return "";
};

export type CssDecl = { property: string; value: string };

const camelToKebab = (prop: string) => prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

const TRANSFORM_PROPS = new Set([
  "x",
  "y",
  "z",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ"
]);

// Whether a single transform component is at its identity value (0 for
// translate/rotate, 1 for scale). A `transform` decl made entirely of identity
// parts produces no visible motion but still establishes a containing block
// and stacking context, which traps consumer overlays (e.g. position: fixed
// sheets) inside the screen scope. We collapse such decls to `transform: none`
// so the scope doesn't trap z-index or fixed positioning at rest.
const ZERO_LENGTH = /^-?0(\.0+)?(px|%|em|rem|vh|vw|vmin|vmax)?$/;
const ZERO_ANGLE = /^-?0(\.0+)?(deg|rad|grad|turn)?$/;
const ONE_SCALAR = /^1(\.0+)?$/;
const isIdentityTransformValue = (prop: string, raw: unknown): boolean => {
  if (prop === "scale" || prop === "scaleX" || prop === "scaleY") {
    if (raw === 1) return true;
    if (typeof raw === "string") return ONE_SCALAR.test(raw.trim());
    return false;
  }
  if (prop === "rotate" || prop === "rotateX" || prop === "rotateY" || prop === "rotateZ") {
    if (raw === 0) return true;
    if (typeof raw === "string") return ZERO_ANGLE.test(raw.trim());
    return false;
  }
  // translate (x, y, z)
  if (raw === 0) return true;
  if (typeof raw === "string") return ZERO_LENGTH.test(raw.trim());
  return false;
};

const transformPart = (prop: string, value: string): string => {
  switch (prop) {
    case "x":
      return `translateX(${value})`;
    case "y":
      return `translateY(${value})`;
    case "z":
      return `translateZ(${value})`;
    case "scale":
      return `scale(${value})`;
    case "scaleX":
      return `scaleX(${value})`;
    case "scaleY":
      return `scaleY(${value})`;
    case "rotate":
    case "rotateZ":
      return `rotate(${value})`;
    case "rotateX":
      return `rotateX(${value})`;
    case "rotateY":
      return `rotateY(${value})`;
    default:
      return "";
  }
};

// Collect the kebab-case CSS property names that a given transition animates
// (across its `initial` and all variant `value`s). Multiple transform-bucket
// props (x/y/scale/rotate/...) collapse to a single `transform` entry, matching
// how targetToDecls emits them. Used by the React layer to mirror exactly the
// properties a transition can write — so a ride-along shared bar tracks
// arbitrary author-defined CSS, not just transform/opacity.
export const collectAnimatedProperties = (transition: Transition): string[] => {
  const props = new Set<string>();
  let hasTransform = false;

  const visit = (target: unknown) => {
    if (!isPlainObject(target)) return;
    for (const key of Object.keys(target)) {
      const raw = (target as Record<string, unknown>)[key];
      if (formatValue(key, raw) === "") continue;
      if (TRANSFORM_PROPS.has(key)) {
        hasTransform = true;
      } else {
        props.add(camelToKebab(key));
      }
    }
  };

  visit(transition.initial);
  for (const variant of Object.values(transition.variants)) {
    visit(variant.value);
  }

  if (hasTransform) props.add("transform");
  return Array.from(props);
};

export const targetToDecls = (
  target: TransitionVariantValue["value"] | InitialTarget
): CssDecl[] => {
  if (!isPlainObject(target)) return [];

  const transformParts: string[] = [];
  let allTransformIdentity = true;
  const others: CssDecl[] = [];

  for (const prop of Object.keys(target)) {
    const raw = (target as Record<string, unknown>)[prop];
    const value = formatValue(prop, raw);
    if (value === "") continue;

    if (TRANSFORM_PROPS.has(prop)) {
      transformParts.push(transformPart(prop, value));
      if (!isIdentityTransformValue(prop, raw)) {
        allTransformIdentity = false;
      }
    } else {
      others.push({ property: camelToKebab(prop), value });
    }
  }

  if (transformParts.length > 0) {
    others.push({
      property: "transform",
      value: allTransformIdentity ? "none" : transformParts.join(" ")
    });
  }

  return others;
};

const declsToBlock = (decls: CssDecl[]): string =>
  decls.map((d) => `  ${d.property}: ${d.value};`).join("\n");

export const easingToCss = (ease: AnimationOptions["ease"] | undefined): string => {
  if (Array.isArray(ease)) {
    if (ease.length === 4 && ease.every((n) => typeof n === "number")) {
      return `cubic-bezier(${(ease as number[]).join(", ")})`;
    }
    return "linear";
  }
  if (typeof ease === "string") {
    const map: Record<string, string> = {
      linear: "linear",
      easeIn: "ease-in",
      easeOut: "ease-out",
      easeInOut: "ease-in-out",
      circIn: "cubic-bezier(0, 0.55, 0.45, 1)",
      circOut: "cubic-bezier(0.55, 0, 1, 0.45)",
      backIn: "cubic-bezier(0.31, 0.01, 0.66, -0.59)",
      backOut: "cubic-bezier(0.33, 1.53, 0.69, 0.99)",
      anticipate: "cubic-bezier(0.36, 0, 0.66, -0.56)"
    };
    return map[ease] ?? "ease";
  }
  return "ease";
};

const variantDuration = (options: AnimationOptions | undefined): number => {
  if (!options) return 0;
  const candidate = (options as { duration?: number }).duration;
  return typeof candidate === "number" && candidate >= 0 ? candidate : 0;
};

const variantDelay = (options: TransitionVariantValue["options"] | undefined): number => {
  if (!options) return 0;
  return typeof options.delay === "number" && options.delay > 0 ? options.delay : 0;
};

const restAttrSelector = (transitionName: string, variant: TransitionVariant): string => {
  const [status, active] = variant.split("-");
  return (
    `[data-flemo-screen]` +
    `[data-flemo-transition="${transitionName}"]` +
    `[data-flemo-status="${status}"]` +
    `[data-flemo-active="${active}"]`
  );
};

const restDecoratorSelector = (decoratorName: string, variant: TransitionVariant): string => {
  const [status, active] = variant.split("-");
  return (
    `[data-flemo-decorator]` +
    `[data-flemo-decorator-name="${decoratorName}"]` +
    `[data-flemo-status="${status}"]` +
    `[data-flemo-active="${active}"]`
  );
};

export const animationName = (
  scope: "screen" | "decorator",
  name: string,
  variant: TransitionVariant
) => `flemo-${scope}-${cssIdentifier(name)}-${variant}`;

const compileVariantBlock = (
  scope: "screen" | "decorator",
  name: string,
  variant: TransitionVariant,
  fromValue: TransitionVariantValue["value"] | InitialTarget,
  toVariant: TransitionVariantValue,
  selectorBuilder: (n: string, v: TransitionVariant) => string
): string => {
  const fromDecls = targetToDecls(fromValue);
  const toDecls = targetToDecls(toVariant.value);
  const duration = variantDuration(toVariant.options);
  const delay = variantDelay(toVariant.options);
  const easing = easingToCss(toVariant.options?.ease);

  const selector = selectorBuilder(name, variant);

  // Variants with no animatable target — emit a rest rule so the element
  // simply holds the target value with no animation.
  if (toDecls.length === 0 && fromDecls.length === 0) {
    return "";
  }

  // No duration: snap directly to the target (no keyframe, no animationend).
  if (duration <= 0 && delay <= 0) {
    if (toDecls.length === 0) return "";
    return `${selector} {\n${declsToBlock(toDecls)}\n  animation: none;\n}`;
  }

  const keyframe = animationName(scope, name, variant);
  const keyframeBlock = [
    `@keyframes ${keyframe} {`,
    `  from {`,
    declsToBlock(fromDecls).replace(/^/gm, "  "),
    `  }`,
    `  to {`,
    declsToBlock(toDecls).replace(/^/gm, "  "),
    `  }`,
    `}`
  ].join("\n");

  const animationProp = [
    `${keyframe}`,
    `${duration}s`,
    easing,
    delay > 0 ? `${delay}s` : null,
    "both"
  ]
    .filter(Boolean)
    .join(" ");

  // `will-change` is scoped to the variant-active rule (PUSHING/POPPING/...)
  // and lists exactly the properties this variant writes — whatever the
  // author put in their `initial` / variant `value`. The browser promotes a
  // compositor layer right before the animation starts and drops it the
  // moment the status flips to IDLE/COMPLETED. Keeps the animation off the
  // main-thread style/layout/paint path for sustained 60fps regardless of
  // which CSS properties the transition actually animates.
  const animatedProperties = Array.from(
    new Set([...fromDecls.map((d) => d.property), ...toDecls.map((d) => d.property)])
  );
  const willChangeDecl =
    animatedProperties.length > 0 ? `  will-change: ${animatedProperties.join(", ")};\n` : "";

  const ruleBlock = `${selector} {\n  animation: ${animationProp};\n${willChangeDecl}}`;

  return `${keyframeBlock}\n${ruleBlock}`;
};

const compileRestBlock = (
  selectorBuilder: (n: string, v: TransitionVariant) => string,
  name: string,
  variant: TransitionVariant,
  variantValue: TransitionVariantValue
): string => {
  const decls = targetToDecls(variantValue.value);
  if (decls.length === 0) return "";
  const selector = selectorBuilder(name, variant);
  return `${selector} {\n${declsToBlock(decls)}\n}`;
};

export const compileTransitionStyles = (
  transitions: Iterable<Transition>,
  decorators: Iterable<Decorator>
): string => {
  const blocks: string[] = [];

  for (const transition of transitions) {
    const name = transition.name;

    for (const variant of TRANSITION_VARIANTS) {
      const variantValue = transition.variants[variant];
      const fromKey = FROM_VARIANT[variant];

      if (fromKey === "self") {
        blocks.push(compileRestBlock(restAttrSelector, name, variant, variantValue));
        continue;
      }

      const fromValue =
        fromKey === "initial" ? transition.initial : transition.variants[fromKey].value;

      blocks.push(
        compileVariantBlock("screen", name, variant, fromValue, variantValue, restAttrSelector)
      );
    }
  }

  for (const decorator of decorators) {
    const name = decorator.name;

    for (const variant of DECORATOR_VARIANTS) {
      const variantValue = decorator.variants[variant];
      const fromKey = FROM_VARIANT[variant];

      if (fromKey === "self") {
        blocks.push(compileRestBlock(restDecoratorSelector, name, variant, variantValue));
        continue;
      }

      const fromValue =
        fromKey === "initial" ? decorator.initial : decorator.variants[fromKey].value;

      blocks.push(
        compileVariantBlock(
          "decorator",
          name,
          variant,
          fromValue,
          variantValue,
          restDecoratorSelector
        )
      );
    }
  }

  return blocks.filter((b) => b.length > 0).join("\n\n");
};

export const variantHasAnimation = (
  transitionLike: Pick<Transition, "initial" | "variants">,
  variant: TransitionVariant
): boolean => {
  const fromKey = FROM_VARIANT[variant];
  if (fromKey === "self") return false;

  const variantValue = transitionLike.variants[variant];
  const duration = variantDuration(variantValue.options);
  const delay = variantDelay(variantValue.options);
  if (duration <= 0 && delay <= 0) return false;

  const fromValue =
    fromKey === "initial" ? transitionLike.initial : transitionLike.variants[fromKey].value;

  const fromDecls = targetToDecls(fromValue);
  const toDecls = targetToDecls(variantValue.value);

  return fromDecls.length > 0 || toDecls.length > 0;
};
