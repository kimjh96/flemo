import type { AnimationOptions, InitialTarget } from "@transition/cssTypes";
import type { Transition, TransitionVariant, TransitionVariantValue } from "@transition/typing";

import {
  FROM_VARIANT,
  TRANSITION_VARIANTS,
  variantDelay,
  variantDuration
} from "@transition/variantMotion";

import type { Decorator } from "@transition/decorator/typing";
import type { PartTransition } from "@transition/partTransition/typing";

const DECORATOR_VARIANTS = TRANSITION_VARIANTS;

const cssIdentifier = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, "_");

const isPlainObject = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

// CSS properties whose `<number>` values must NOT be suffixed with a unit.
// Mirrors the well-known list React uses for inline-style coercion so that
// `{ lineHeight: 1.5 }` / `{ fontWeight: 600 }` / `{ zIndex: 3 }` compile to
// `line-height: 1.5;` etc. instead of an invalid `…px` value.
const UNITLESS_PROPS = new Set([
  "opacity",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
  "aspectRatio",
  "columnCount",
  "columns",
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "gridArea",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowStart",
  "lineHeight",
  "lineClamp",
  "order",
  "orphans",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
  // SVG numerics
  "fillOpacity",
  "floodOpacity",
  "stopOpacity",
  "strokeOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
  "strokeWidth"
]);

const numberToPx = (value: number, prop: string) => {
  // CSS custom properties are typeless. A number could mean "16 spacing
  // tokens", a count, a ratio, etc. Emit the raw scalar so authors can
  // shape the unit themselves at use site (e.g., `calc(var(--space) * 1px)`).
  // Mirrors React's `name.startsWith("--")` short-circuit.
  if (prop.startsWith("--")) return `${value}`;
  if (UNITLESS_PROPS.has(prop)) return `${value}`;
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
    // 3D translate functions on purpose, NOT translateX/translateY: Chromium
    // pixel-snaps a 2D-transform-animated layer when its content rasters
    // heavily (gradient surfaces), turning the slow deceleration tail into a
    // visible hold-then-step stutter, and re-snapping ~1px at completion. The
    // 3D form routes the layer through direct texture-filtered compositing,
    // which slides sub-pixel smoothly — glass-recorded A/B on identical
    // content: 2D shows repeated mid-motion stalls, 3D is monotonic to rest.
    // WebKit behaves identically for both forms.
    case "x":
      return `translate3d(${value}, 0, 0)`;
    case "y":
      return `translate3d(0, ${value}, 0)`;
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
// properties a transition can write, so a ride-along shared bar tracks
// arbitrary author-defined CSS, not just transform/opacity.
export const collectAnimatedProperties = (transition: Transition): string[] => {
  // A property held CONSTANT across every target (same formatted value in
  // `initial` and all variants — e.g. cupertino's leading-edge shadow) never
  // interpolates, so it must not appear here: it would leak into `will-change`
  // and the ride-along property lists for no reason.
  const values = new Map<string, Set<string>>();
  let transformVaries = false;
  const transformSignatures = new Set<string>();

  const visit = (target: unknown) => {
    if (!isPlainObject(target)) return;
    const signature: string[] = [];
    for (const key of Object.keys(target)) {
      const raw = (target as Record<string, unknown>)[key];
      const formatted = formatValue(key, raw);
      if (formatted === "") continue;
      if (TRANSFORM_PROPS.has(key)) {
        signature.push(`${key}:${formatted}`);
      } else {
        const set = values.get(camelToKebab(key)) ?? new Set<string>();
        set.add(formatted);
        values.set(camelToKebab(key), set);
      }
    }
    transformSignatures.add(signature.sort().join("|"));
  };

  visit(transition.initial);
  for (const variant of Object.values(transition.variants)) {
    visit(variant.value);
  }

  // Distinct signatures across targets (including the empty one for targets
  // with no transform) mean the transform actually interpolates somewhere.
  transformVaries = transformSignatures.size > 1;

  const props = Array.from(values.entries())
    .filter(([, set]) => set.size > 1)
    .map(([prop]) => prop);
  if (transformVaries) props.push("transform");
  return props;
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

// Shared-bar ride-along selector. When a partner screen doesn't own the bar,
// the bar's wrapper sets `data-flemo-bar-riding="true"` for the duration of
// the transition. Pairing it as a sibling selector with the screen rule lets
// both elements run the same `@keyframes` on the compositor: no JS rAF
// mirroring, no main-thread style read/write per frame, perfectly synced.
const barAttrSelector = (transitionName: string, variant: TransitionVariant): string => {
  const [status, active] = variant.split("-");
  return (
    `[data-flemo-bar]` +
    `[data-flemo-bar-transition="${transitionName}"]` +
    `[data-flemo-bar-status="${status}"]` +
    `[data-flemo-bar-active="${active}"]` +
    `[data-flemo-bar-riding="true"]`
  );
};

// A <PartTransition name="..."> child element. Referenced by name (not bound to a
// screen transition like a decorator), driven by the SAME status / active the
// screen scope exposes — so a programmatic transition runs the element's
// own `@keyframes` on the compositor, in lockstep with the screen, no JS.
const partSelector = (name: string, variant: TransitionVariant): string => {
  const [status, active] = variant.split("-");
  return (
    `[data-flemo-part-name="${name}"]` +
    `[data-flemo-status="${status}"]` +
    `[data-flemo-active="${active}"]`
  );
};

export const animationName = (
  scope: "screen" | "decorator" | "part",
  name: string,
  variant: TransitionVariant
) => `flemo-${scope}-${cssIdentifier(name)}-${variant}`;

const compileVariantBlock = (
  scope: "screen" | "decorator" | "part",
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

  // For the screen scope, also target a riding shared bar with the same
  // rule so the compositor drives both elements off one `@keyframes`.
  // Decorators don't have a bar counterpart. They stay screen-only.
  const screenSelector = selectorBuilder(name, variant);
  const selector =
    scope === "screen" ? `${screenSelector},\n${barAttrSelector(name, variant)}` : screenSelector;

  // Variants with no animatable target: emit a rest rule so the element
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
  // and lists exactly the properties this variant writes, whatever the
  // author put in their `initial` / variant `value`. The browser promotes a
  // compositor layer right before the animation starts and drops it the
  // moment the status flips to IDLE/COMPLETED. Keeps the animation off the
  // main-thread style/layout/paint path for sustained 60fps regardless of
  // which CSS properties the transition actually animates.
  // Constant properties (identical formatted value on both ends — e.g.
  // cupertino's leading-edge shadow) never interpolate and must not be
  // promoted: will-change on a paint property like box-shadow only bloats
  // the layer for nothing.
  const fromByProp = new Map(fromDecls.map((d) => [d.property, d.value]));
  const toByProp = new Map(toDecls.map((d) => [d.property, d.value]));
  const animatedProperties = Array.from(new Set([...fromByProp.keys(), ...toByProp.keys()])).filter(
    (property) => fromByProp.get(property) !== toByProp.get(property)
  );
  const willChangeDecl =
    animatedProperties.length > 0 ? `  will-change: ${animatedProperties.join(", ")};\n` : "";

  // `contain: layout` confines layout invalidation inside the transitioning
  // scope, so a heavy arrival screen's reflow doesn't propagate up through
  // ancestors and steal time from the in-flight compositor animation.
  // Active-variant-scoped on purpose: it establishes a new containing block
  // for absolute/fixed descendants, which we only want during the
  // transition window (status flips back to IDLE/COMPLETED → rule stops
  // matching → containing block goes away, fixed bars re-anchor as before).
  //
  // `pointer-events: none` skips hit-testing on the moving element. Saves a
  // compositor hit-test pass per frame and also acts as a correctness gate.
  // A tap during the transition won't enqueue a second navigation.
  //
  // Scoped to PUSHING and REPLACING only. Pop's arrival screen is unhidden
  // by ScreenFreeze (never re-mounted), so there's no mount work to isolate,
  // and the e2e harness showed a small but consistent regression (~8ms)
  // on heavy-DOM exiting screens during pop, attributable to containment
  // block evaluation cost on a 2k-node tree with no upside to offset it.
  const status = variant.split("-")[0];
  const wantsContainment = status === "PUSHING" || status === "REPLACING";
  const containmentDecl = wantsContainment ? `  contain: layout;\n  pointer-events: none;\n` : "";

  const ruleBlock = `${selector} {\n  animation: ${animationProp};\n${willChangeDecl}${containmentDecl}}`;

  // Destination pre-raster park. While a freshly started transition is held
  // (see the hold rule appended to the sheet), a COVERED screen whose `from`
  // frame hides it (fully off-screen or transparent) may park at its
  // DESTINATION instead of pausing at the hidden `from`: the browser then
  // genuinely rasterizes the tiles the animation is about to reveal, so the
  // slide plays over pre-rastered content instead of chasing raster
  // mid-animation (the dropped-frame hitch on heavy screens). Emitted only for
  // the inactive ("-false") side — that screen sits UNDER the active one, so
  // the park is invisible when the cover is opaque. The binding renders
  // `data-flemo-anim-hold="park"` only after verifying the covering screen's
  // opacity (see ScreenSurface); a translucent cover keeps the paused hold.
  // Variants without a park rule fall back to the global paused rule even
  // under the "park" attribute, so the attribute is always safe to render.
  const parkBlock =
    scope === "screen" &&
    variant.endsWith("-false") &&
    targetHidesScreen(fromValue) &&
    toDecls.length > 0
      ? `\n${screenSelector}[data-flemo-anim-hold="park"] {\n  animation: none;\n${declsToBlock(
          toDecls
        )}\n}`
      : "";

  // The push-side mirror of the park: an ACTIVE entering screen starts fully
  // off-screen, so none of its tiles are rasterized during the hold, and the
  // slide then rasterizes them as it reveals — on raster-heavy content
  // (gradients) that stalls presentation frames mid-motion and near landing.
  // Parking it at its DESTINATION but UNDER the previous screen (z-index
  // below; the binding gates on that screen's opaque surface) rasterizes the
  // whole layer while the user still sees the covering screen; rasterization
  // lives in layer space, so the tiles stay valid when the release snaps the
  // screen back to its hidden `from` and the animation replays over them.
  // The stacking demotion itself lives on the OUTER screen container in the
  // binding (siblings stack by DOM order; only the container can sink below
  // the previous screen).
  const parkUnderBlock =
    scope === "screen" &&
    variant.endsWith("-true") &&
    (variant.startsWith("PUSHING") || variant.startsWith("REPLACING")) &&
    targetHidesScreen(fromValue) &&
    toDecls.length > 0
      ? `\n${screenSelector}[data-flemo-anim-hold="park-under"] {\n  animation: none;\n${declsToBlock(
          toDecls
        )}\n}`
      : "";

  return `${keyframeBlock}\n${ruleBlock}${parkBlock}${parkUnderBlock}`;
};

// Whether a variant's `from` target leaves the screen invisible on its first
// frame: fully transparent, or translated fully off-screen (a percentage
// offset >= 100%).
const targetHidesScreen = (value: TransitionVariantValue["value"] | InitialTarget): boolean => {
  if (!value) return false;
  if (value.opacity === 0) return true;
  const offscreen = (offset: string | number | undefined) =>
    typeof offset === "string" &&
    offset.trim().endsWith("%") &&
    Math.abs(parseFloat(offset)) >= 100;
  return offscreen(value.x) || offscreen(value.y);
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
  decorators: Iterable<Decorator>,
  partTransitions: Iterable<PartTransition> = []
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

  for (const partTransition of partTransitions) {
    const name = partTransition.name;

    for (const variant of DECORATOR_VARIANTS) {
      const variantValue = partTransition.variants[variant];
      const fromKey = FROM_VARIANT[variant];

      if (fromKey === "self") {
        blocks.push(compileRestBlock(partSelector, name, variant, variantValue));
        continue;
      }

      const fromValue =
        fromKey === "initial" ? partTransition.initial : partTransition.variants[fromKey].value;

      blocks.push(
        compileVariantBlock("part", name, variant, fromValue, variantValue, partSelector)
      );
    }
  }

  return [
    ...blocks.filter((b) => b.length > 0),
    ANIM_HOLD_RULE,
    TRANSITION_QUARANTINE_RULE,
    ARRIVAL_HOLD_RULE
  ].join("\n\n");
};

// A freshly-started transition animation is held paused while the binding
// paints the entering screen's first frame, then released. iOS WebKit anchors
// a CSS animation's timeline when the style change commits, so when that first
// frame is expensive (layout + raster of a heavy subtree on a mobile GPU) the
// timeline keeps running while nothing new is presented and the opening of the
// transition is never displayed — the transition reads as abbreviated. The
// binding renders `data-flemo-anim-hold="true"` on the scope, shared bars, and
// decorator for the hold window; `fill: both` keeps the keyframe's `from`
// frame applied while paused. `!important` so this outranks the variant rules'
// higher-specificity `animation` shorthand (which resets play-state to
// running). The nested selector covers `<Part>` elements inside held bars.
const ANIM_HOLD_RULE = [
  `[data-flemo-anim-hold="true"],`,
  `[data-flemo-anim-hold="park"],`,
  `[data-flemo-anim-hold="park-under"],`,
  `[data-flemo-anim-hold="true"] [data-flemo-part-name],`,
  `[data-flemo-anim-hold="park"] [data-flemo-part-name],`,
  `[data-flemo-anim-hold="park-under"] [data-flemo-part-name] {`,
  `  animation-play-state: paused !important;`,
  `}`
].join("\n");

// Consumer-animation quarantine: while a navigation runs, no CSS animation
// exists inside its COLD screens (their own <Part> elements excepted — that
// choreography belongs to the transition). Profiled on device (iPhone, Safari
// timeline): a cold first entry mounted ~380 skeleton shimmer animations, each
// an accelerated `transform` loop — ~380 compositor layers inside the entering
// screen. The release-time restructure (park z-order restored + the screen's
// own animation promoting its layer) then re-committed that whole subtree:
// one 65ms composite pass plus ~70ms of render-server backpressure, swallowing
// a 150ms fade wholesale — zero intermediate frames presented. Three hard-won
// details of this rule:
// - FRESH-MOUNT sides only: the entering screen of a push/replace, whose
//   whole subtree (and its animations) is born in the transition commit;
//   suppressing those costs no visible state. The WARM exiting side keeps
//   its animations untouched: its layers are already built (no storm to
//   prevent), and killing an infinite ambient animation there snaps it to
//   its base pose and restarts its phase — observed on a hero card-roll that
//   visibly flipped to the wrong card on every navigation. The POP
//   destination is exempt too: its animations were already terminated by the
//   freeze (display: none) and restart at the unfreeze commit — under the
//   flight's own motion, where a phase-zero restart is least visible;
//   quarantining it only moved that restart to the landing, where a settled
//   eye catches the pose jump.
// - `animation: none`, NOT `animation-play-state: paused`. A paused animation
//   still exists, so WebKit still builds and commits its compositor layer;
//   only a non-existent animation prevents the layer storm. Everything starts
//   when the status flips to COMPLETED — on a fresh subtree that is the
//   natural begin-at-arrival, not a restart.
// - `::before`/`::after` variants. The descendant selector alone matches real
//   elements only, and shimmer-style effects live on pseudo-elements.
const QUARANTINE_COLD_VARIANTS = [
  ["PUSHING", "true"],
  ["REPLACING", "true"]
];
const TRANSITION_QUARANTINE_RULE = [
  ...QUARANTINE_COLD_VARIANTS.flatMap(([status, active], variantIndex) =>
    ["", "::before", "::after"].map((pseudo, pseudoIndex) => {
      const last =
        variantIndex === QUARANTINE_COLD_VARIANTS.length - 1 && pseudoIndex === 2 ? " {" : ",";
      return `[data-flemo-screen][data-flemo-status="${status}"][data-flemo-active="${active}"] :not([data-flemo-part-name])${pseudo}${last}`;
    })
  ),
  `  animation: none !important;`,
  `}`
].join("\n");

// In-flight commit hold (see core/engine/arrivalHold.ts): content that
// arrives inside a screen DURING its transition is held off-glass and
// reflected in one commit at rest, so a mid-flight Suspense swap can never
// punch through a decelerating motion. The engine stamps the attribute; this
// rule is the entire visual mechanism.
const ARRIVAL_HOLD_RULE = [`[data-flemo-held-arrival] {`, `  display: none !important;`, `}`].join(
  "\n"
);

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
