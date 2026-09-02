import type { AnimationOptions, InitialTarget } from "@transition/cssTypes";
import { percentRatio, rideLength } from "@transition/rideOffset";
import type { Transition, TransitionVariant, TransitionVariantValue } from "@transition/typing";

import {
  FROM_VARIANT,
  TRANSITION_VARIANTS,
  variantDelay,
  variantDuration
} from "@transition/variantMotion";

import {
  ACTIVE_ATTR,
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  ANIM_HOLD_PAUSED_VALUES,
  attrSelector,
  attrValueSelector,
  BAR_ACTIVE_ATTR,
  BAR_ATTR,
  BAR_RIDING_ATTR,
  BAR_STATUS_ATTR,
  BAR_TRANSITION_ATTR,
  CREEP_ATTR,
  DECORATOR_ATTR,
  DECORATOR_NAME_ATTR,
  DESK_HEAD_ATTR,
  GOVERNED_ATTR,
  HELD_ARRIVAL_ATTR,
  LAYER_HOST_ATTR,
  LAYER_SLOT_ATTR,
  MORPH_ATTR,
  MORPH_GHOST_ATTR,
  PARK_HEAD_ATTR,
  PART_NAME_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITION_ATTR
} from "@dom/attributes";

import { resolveDecoratorClock } from "@transition/decorator/resolveDecoratorClock";

import { resolvePartClock } from "@transition/partTransition/resolvePartClock";

import type { Decorator } from "@transition/decorator/typing";
import type { PartTransition } from "@transition/partTransition/typing";

const DECORATOR_VARIANTS = TRANSITION_VARIANTS;

const CREEP_NUDGE = "translateZ(0.02px)";

// The opacity a parked screen waits at: low enough that nothing reads as a
// ghost over its cover, above zero so the browser still paints and composites
// it (which is the entire point of parking). Shared by the park-over hold rule
// and the head that carries the same pose past the release.
const PARK_OPACITY = "0.02";

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

const transformPart = (prop: string, value: string, ride: boolean): string => {
  if (ride && prop === "y") {
    const ratio = percentRatio(value);
    if (ratio !== null) return transformPart(prop, rideLength(ratio), false);
  }
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
export const collectAnimatedProperties = (
  transition: Pick<Transition, "initial" | "variants">
): string[] => {
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

// `ride` compiles the copy a shared bar runs instead of the screen's own
// keyframes: identical in every respect except that percentage x / y offsets
// are restated against the screen box the binding publishes. See rideOffset.ts
// for why a rider cannot use its own box, and why only the bars need this.
export const targetToDecls = (
  target: TransitionVariantValue["value"] | InitialTarget,
  ride = false
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
      transformParts.push(transformPart(prop, value, ride));
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

// Whether two endpoint declaration lists actually interpolate: some property
// sits on one side only, or sits on both with different values. A property
// holding the SAME value on both ends never moves — the element's own rule
// carries it instead (see constantProperties in compileVariantBlock) — so a
// pair of endpoints that agree on everything is a rest state wearing a clock.
const declsInterpolate = (fromDecls: CssDecl[], toDecls: CssDecl[]): boolean => {
  const from = new Map(fromDecls.map((decl) => [decl.property, decl.value]));
  const to = new Map(toDecls.map((decl) => [decl.property, decl.value]));
  for (const property of new Set([...from.keys(), ...to.keys()])) {
    if (from.get(property) !== to.get(property)) return true;
  }
  return false;
};

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

// RETIRED (2026-08-13, A/B on device): governed-tier FRONT-SOFTENING.
//
// The compiler used to pre-compute a gentler variant of every front-loaded
// SCREEN curve and emit it behind a `:root[data-flemo-governed]` gate, to
// answer the "60-100 jump" — under iOS Low Power Mode the main pipeline runs
// ~30Hz, so a curve packing half its travel into the first ~20% crosses the
// opening in 5-6 presented frames, faster than the eye locks on.
//
// It was prescribed against a BROKEN pipeline (var-timing demotion plus the
// opening skips). With those cured, the softened curve became the "different
// transition" the user could feel against the authored iOS curve, so the flag
// went off — and then sat off, emitting nothing, for the rest of its life.
// Deleted with the rAF player; the opening is protected by the flat head and
// the settle gate instead. Do not re-derive it without re-checking that the
// pipeline underneath is healthy first — that was the whole lesson.

const restAttrSelector = (transitionName: string, variant: TransitionVariant): string => {
  const [status, active] = variant.split("-");
  return (
    attrSelector(SCREEN_ATTR) +
    attrValueSelector(TRANSITION_ATTR, transitionName) +
    attrValueSelector(STATUS_ATTR, status!) +
    attrValueSelector(ACTIVE_ATTR, active!)
  );
};

// A decorator is matched by the transition that names it as well as by its own
// name, because its clock comes from that transition (resolveDecoratorClock).
// The same decorator on two transitions of different lengths is two rule sets,
// and without the transition in the selector they would be one, with the
// winner decided by source order.
const restDecoratorSelector = (
  transitionName: string,
  decoratorName: string,
  variant: TransitionVariant
): string => {
  const [status, active] = variant.split("-");
  return (
    attrSelector(DECORATOR_ATTR) +
    attrValueSelector(DECORATOR_NAME_ATTR, decoratorName) +
    attrValueSelector(TRANSITION_ATTR, transitionName) +
    attrValueSelector(STATUS_ATTR, status!) +
    attrValueSelector(ACTIVE_ATTR, active!)
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
    attrSelector(BAR_ATTR) +
    attrValueSelector(BAR_TRANSITION_ATTR, transitionName) +
    attrValueSelector(BAR_STATUS_ATTR, status!) +
    attrValueSelector(BAR_ACTIVE_ATTR, active!) +
    attrValueSelector(BAR_RIDING_ATTR, "true")
  );
};

// <Layer> slot ride-along selector, and the reason an escaped overlay is not
// an orphan. A slot is a SIBLING of the scope — it has to be, or the screen's
// transform would trap it exactly like the content it left — so nothing moves
// it when the screen moves. Pairing it with the screen rule does, off the same
// `@keyframes`, on the compositor, with no code on either side.
//
// This is the shared bar's trick (see barAttrSelector) applied to the one
// other thing that lives beside a scope and belongs to it. It differs in when
// it applies: a bar rides only when its partner screen does not own it, while
// a slot rides always, because an overlay has exactly one screen and always
// leaves with it.
//
// BOTH boxes can ride, and which one does depends on which screen is moving.
// The HOST rides the screen that renders it, because when that screen flies
// everything it hosts flies with it — a region sliding out from under its own
// sheet is the failure this pairing prevents. A SLOT rides its owner, which
// matters when the owner is a nested screen moving inside a host that is not.
// The binding gives exactly one of them the attributes for any single flight,
// so the two can never compose and send an overlay twice as far as its screen.
const layerRiderSelector = (
  marker: string,
  transitionName: string,
  variant: TransitionVariant
): string => {
  const [status, active] = variant.split("-");
  return (
    attrSelector(marker) +
    attrValueSelector(TRANSITION_ATTR, transitionName) +
    attrValueSelector(STATUS_ATTR, status!) +
    attrValueSelector(ACTIVE_ATTR, active!)
  );
};

// A <PartTransition name="..."> child element. Referenced by name (not bound to a
// screen transition like a decorator), driven by the SAME status / active the
// screen scope exposes — so a programmatic transition runs the element's
// own `@keyframes` on the compositor, in lockstep with the screen, no JS.
const partSelector = (name: string, variant: TransitionVariant): string => {
  const [status, active] = variant.split("-");
  return (
    attrValueSelector(PART_NAME_ATTR, name) +
    attrValueSelector(STATUS_ATTR, status!) +
    attrValueSelector(ACTIVE_ATTR, active!)
  );
};

// The same part, under one particular screen transition.
//
// A part is referenced by name and may appear under any transition in the
// Router, so unlike a decorator it cannot be resolved once. The transition term
// is what picks the right resolved clock (see resolvePartClock), and it also
// carries the specificity: four attribute selectors to the base rule's three,
// so a part INSIDE a screen takes the inherited clock while one mounted outside
// any screen — persistent chrome beside a `<Slot>`, a portal — matches only the
// base rule and keeps exactly what it authored.
const partPairSelector = (
  transitionName: string,
  name: string,
  variant: TransitionVariant
): string => attrValueSelector(TRANSITION_ATTR, transitionName) + partSelector(name, variant);

// One `@keyframes NAME` survives; later blocks with the same name and the same
// body do not.
//
// A part's keyframes are its POSE, which does not depend on the transition
// carrying it — only its clock does, and a clock lives in the rule. So every
// (transition x part) pair re-emits a keyframe set byte-identical to the one
// before it. Dropping the repeats here keeps the pair pass to what actually
// varies, and leaves the emission sites free to state their own output in full
// rather than coordinating over who writes the keyframes.
export const dedupeKeyframeBlocks = (css: string): string => {
  const seen = new Set<string>();
  let out = "";
  let index = 0;

  while (index < css.length) {
    const start = css.indexOf("@keyframes", index);
    if (start === -1) {
      out += css.slice(index);
      break;
    }
    const open = css.indexOf("{", start);
    if (open === -1) {
      out += css.slice(index);
      break;
    }
    let depth = 0;
    let end = open;
    for (; end < css.length; end++) {
      if (css[end] === "{") depth++;
      else if (css[end] === "}" && --depth === 0) break;
    }
    /* v8 ignore next -- the compiler never emits an unbalanced block; this is
       a guard against a caller passing arbitrary text, not a reachable path. */
    if (depth !== 0) {
      out += css.slice(index);
      break;
    }

    const block = css.slice(start, end + 1);
    out += css.slice(index, start);
    if (!seen.has(block)) {
      seen.add(block);
      out += block;
    } else {
      // Swallow the separator the duplicate would have left behind.
      out = out.replace(/\n{2,}$/, "\n\n");
    }
    index = end + 1;
  }

  return out;
};

export const animationName = (
  scope: "screen" | "decorator" | "part",
  name: string,
  variant: TransitionVariant
) => `flemo-${scope}-${cssIdentifier(name)}-${variant}`;

// A decorator's keyframes belong to the PAIR, for the same reason its selector
// does: two transitions naming one decorator run it on two clocks, so they
// cannot share a keyframe name. Both the compiler and the engine's
// cancel/resume wiring resolve the name here so they can never disagree.
export const decoratorAnimationName = (
  transitionName: string,
  decoratorName: string,
  variant: TransitionVariant
) => animationName("decorator", `${transitionName}--${decoratorName}`, variant);

// A head tier plays the SAME flight under a copied keyframe set, so its
// `animationend` / `animationcancel` events carry a suffixed name. Every
// listener that matches a flight by name must accept all of them — a listener
// that recognizes only the base name silently stops resolving the flight, and
// the restart watchdog then replays the whole transition (glass-visible as a
// second fade on REPLACE). Keep this list beside the suffixes the compiler
// emits, and route every name comparison through the matcher.
// Named once, so the matcher below and the compiler that emits the keyframes
// cannot drift apart. They already did: `govpark` and `deskpark` shipped
// without ever being added here, so every parked flight's `animationend` went
// unrecognized. On an iPhone that is the whole reported defect — the restart
// watchdog replayed the transition (the second run is visible on the glass, and
// device-traced: the park keyframe ended at 912ms and started over at 1179ms)
// and the navigation took 1959ms where the desktop tier took 780ms.
export const HEAD_SUFFIXES = {
  governed: "gov",
  desktop: "deskhead",
  creep: "govcreep",
  governedPark: "govpark",
  desktopPark: "deskpark"
} as const;

export const HEAD_ANIMATION_SUFFIXES = Object.values(HEAD_SUFFIXES).map((suffix) => `-${suffix}`);

export const matchesFlightAnimationName = (eventName: string, expectedName: string): boolean =>
  eventName === expectedName ||
  HEAD_ANIMATION_SUFFIXES.some((suffix) => eventName === `${expectedName}${suffix}`);

// One element family's share of a compiled variant: which rule it matches,
// which `@keyframes` it plays and the two endpoints that keyframe holds.
type RideTarget = {
  selector: string;
  keyframe: string;
  fromDecls: CssDecl[];
  toDecls: CssDecl[];
};

const compileVariantBlock = (
  scope: "screen" | "decorator" | "part",
  name: string,
  variant: TransitionVariant,
  fromValue: TransitionVariantValue["value"] | InitialTarget,
  toVariant: TransitionVariantValue,
  selectorBuilder: (n: string, v: TransitionVariant) => string
): string => {
  const authoredFromDecls = targetToDecls(fromValue);
  const authoredToDecls = targetToDecls(toVariant.value);

  // A property with the SAME value on both endpoints never interpolates, so it
  // belongs on the element's rule, not in the keyframes. The overlay decorator
  // is the case in the box: it holds `background-color` at the target dim and
  // animates only `opacity` — its own note says "the keyframe stays
  // single-property" — but the compiler was emitting the constant colour into
  // both keyframe steps anyway. A keyframe listing a property an engine cannot
  // composite is enough to drop the WHOLE animation to the main thread, and
  // engines disagree about which properties those are (Blink only learned to
  // composite background-color in 111 — later than the phones this library is
  // measured on). The rendered result is identical either way: the value is
  // applied by the rule for exactly the window the variant selector matches.
  // `will-change` below already filtered constants out for the same reason.
  const constantProperties = new Set(
    authoredFromDecls
      .filter((decl) =>
        authoredToDecls.some(
          (other) => other.property === decl.property && other.value === decl.value
        )
      )
      .map((decl) => decl.property)
  );
  const constantDecls = authoredFromDecls.filter((decl) => constantProperties.has(decl.property));
  const fromDecls = authoredFromDecls.filter((decl) => !constantProperties.has(decl.property));
  const toDecls = authoredToDecls.filter((decl) => !constantProperties.has(decl.property));
  const duration = variantDuration(toVariant.options);
  const delay = variantDelay(toVariant.options);
  const easing = easingToCss(toVariant.options?.ease);

  // The shared bar's copy of this variant. Identical to the screen's unless the
  // author wrote a percentage x / y offset, which resolves against the box it
  // is applied to — and a bar's box is not the screen's (rideOffset.ts). The
  // copy exists ONLY when it would differ: `declsDiffer` below is what keeps
  // every percentage-free transition, and every axis a bar already matches, on
  // the single shared `@keyframes` the ride-along was designed around.
  const rideAuthoredFromDecls = targetToDecls(fromValue, true);
  const rideAuthoredToDecls = targetToDecls(toVariant.value, true);
  const rideFromDecls = rideAuthoredFromDecls.filter(
    (decl) => !constantProperties.has(decl.property)
  );
  const rideToDecls = rideAuthoredToDecls.filter((decl) => !constantProperties.has(decl.property));
  const declsDiffer = (left: CssDecl[], right: CssDecl[]) =>
    declsToBlock(left) !== declsToBlock(right);
  const needsRideCopy =
    scope === "screen" &&
    (declsDiffer(rideAuthoredFromDecls, authoredFromDecls) ||
      declsDiffer(rideAuthoredToDecls, authoredToDecls));

  // For the screen scope, also target a riding shared bar and any <Layer>
  // slot with the same rule so the compositor drives every one of them off one
  // `@keyframes`. Both live BESIDE the scope rather than inside it, which is
  // why neither moves without being named here.
  // Decorators have no counterpart of either kind. They stay screen-only.
  const screenSelector = selectorBuilder(name, variant);
  const barSelector = barAttrSelector(name, variant);
  const selector =
    scope === "screen"
      ? [
          screenSelector,
          // A bar that needs the corrected distance leaves this list and takes
          // its own rule below. It must not stay here as well: two rules naming
          // the same element would make the winner depend on source order, and
          // the corrected one has to win outright.
          ...(needsRideCopy ? [] : [barSelector]),
          layerRiderSelector(LAYER_HOST_ATTR, name, variant),
          layerRiderSelector(LAYER_SLOT_ATTR, name, variant)
        ].join(",\n")
      : screenSelector;

  // Variants with no animatable target: emit a rest rule so the element
  // simply holds the target value with no animation.
  if (authoredToDecls.length === 0 && authoredFromDecls.length === 0) {
    return "";
  }

  // NOTHING INTERPOLATES, whatever the clock says. `fromDecls` / `toDecls` are
  // the authored endpoints minus every property that holds the same value on
  // both (constantProperties above), so both being empty means the two ends
  // agree on all of them: there is no motion to compile at any duration.
  //
  // The check used to be the duration alone, which was enough while every such
  // variant was also authored at zero — a decorator's `idle` sits at
  // PUSHING-true with `initial` as its `from` and the same values as its `to`,
  // and its author wrote `duration: 0` there because there was nothing to run.
  // Once a clock can be INHERITED rather than authored (see
  // resolveDecoratorClock) that coincidence breaks: the screen's 0.7s arrives
  // on a variant whose endpoints are identical, and the compiler would emit
  // `@keyframes { from {} to {} }` plus a 0.7s rule to play it. An empty
  // animation still fires `animationend`, so variantHasAnimation would report
  // the element as a participant and the engine would wait out a flight for a
  // thing that never moves.
  const interpolates = declsInterpolate(authoredFromDecls, authoredToDecls);

  // No duration, or no motion: snap directly to the target (no keyframe, no
  // animationend).
  if (!interpolates || (duration <= 0 && delay <= 0)) {
    if (authoredToDecls.length === 0) return "";
    const snap = `${selector} {\n${declsToBlock(authoredToDecls)}\n  animation: none;\n}`;
    if (!needsRideCopy) return snap;
    return `${snap}\n${barSelector} {\n${declsToBlock(rideAuthoredToDecls)}\n  animation: none;\n}`;
  }

  const keyframe = animationName(scope, name, variant);

  // One emission, run once for the screen and its same-box riders and, when the
  // distances differ, once more for the shared bar. Everything a variant fixes
  // — duration, easing, delay, the governed and desktop heads, will-change,
  // containment — is shared; only the selector, the keyframe name and the two
  // endpoint declaration lists change between them.
  const screenTarget: RideTarget = { selector, keyframe, fromDecls, toDecls };
  const barTarget: RideTarget = {
    selector: barSelector,
    keyframe: `${keyframe}-ride`,
    fromDecls: rideFromDecls,
    toDecls: rideToDecls
  };
  const keyframeBlockFor = (target: RideTarget) =>
    [
      `@keyframes ${target.keyframe} {`,
      `  from {`,
      declsToBlock(target.fromDecls).replace(/^/gm, "  "),
      `  }`,
      `  to {`,
      declsToBlock(target.toDecls).replace(/^/gm, "  "),
      `  }`,
      `}`
    ].join("\n");
  const keyframeBlock = keyframeBlockFor(screenTarget);

  const animationPropFor = (kf: string) =>
    [`${kf}`, `${duration}s`, easing, delay > 0 ? `${delay}s` : null, "both"]
      .filter(Boolean)
      .join(" ");

  // Governed-tier overrides, consumed as longhand declarations after the shorthand.
  // Both vars are published by the engine before the release and stay unset
  // (fallbacks: 0ms / 1) everywhere else — pure style, resolved at the
  // animation's own birth: no WAAPI touch, so WebKit's accelerated
  // (out-of-process) playback is never at risk.
  //
  // --flemo-gov-birth-hold: a compiled clock is born at the release
  // update's style resolution but its first frame reaches the glass only
  // after that update's paint and the compositor's commit — under iOS Low
  // Power Mode (main pipeline ~30Hz) that's 2-3 frames of aging, so the
  // first PRESENTED frame sits 25-40% into a fast curve: the device-
  // reported "starts at 60" jump. The engine predicts that latency (see
  // lowPowerCadence) and the delay moves the clock's zero to the first
  // presented frame while fill-mode `both` (backwards) holds the authored
  // from-pose — the same pose the hold already shows.
  //
  // --flemo-gov-stretch: the user-selected time dilation, applied to
  // the COMPILED animation so it keeps its panel-rate presentation (the
  // 60fps screen-recording round proved compiled flights present at panel
  // rate under LPM while rAF is capped ~30Hz). At wall-clock playback the
  // authored curve's front-loaded 0-60% crosses in 5-6 capped-eye frames —
  // faster than the eye locks on; stretching the duration by the measured
  // cadence ratio (~2x) gives the opening enough presented frames to READ
  // as motion. Authored per-part delays stretch by the same factor so the
  // choreography's relative timing is preserved.
  // LITERAL timing only — no var()/calc() in animation-delay or -duration.
  // Device-bisected (2026-08-13, tab-starve rig): a screen fade whose
  // timing depended on custom properties (the earlier
  // calc(var(--flemo-gov-*)) plumbing) lost WebKit's compositor playback
  // and collapsed to a 2-frame snap under main-thread starvation, while
  // literalizing EITHER property restored a fully presented fade. The LPM
  // birth hold and REPLACING stretch are applied by the ENGINE as inline
  // literal longhands on the participants instead (pre-birth, style-only).
  const delayDecl = "";
  const durationDecl = "";
  // Governed REPLACING: the hold lives INSIDE the keyframes as a flat head,
  // not in animation-delay. Device-chased to the end (2026-08-13): with a
  // delay-based hold the fade-start starvation rode the delay expiry at
  // every hold size — WebKit commits the accelerated animation only when
  // the ACTIVE phase begins, and that layerization is the ~100ms cliff on
  // a governor-throttled phone. A flat-head keyframe form is active from
  // birth: the accelerated commit happens during the (invisible) held
  // head, the UI process then plays the whole fade autonomously, and the
  // authored from→to curve is reproduced exactly after the head. Static,
  // literal, gate-scoped — the engine only raises data-flemo-governed.
  // Per-status head lengths, shared with the engine's deadline math (see
  // GOVERNED_HEAD_MS below). REPLACING's 0.35 is the device-verified value that
  // closed the tab swallow; PUSHING covers the measured release latency
  // tier; POPPING stays short — its release is measured clean and it is
  // the most latency-sensitive gesture.
  // FLOOR (device-dialed 2026-08-13): 180/100/80. One notch below
  // (120/70/60) the whole flight fit inside a worst-case governor
  // starvation window and transitions vanished ("무반응 후 즉시 전환");
  // battle-era 350/200/120 was 2x too pessimistic.: walked down from the battle-era 350/200/120
  // — the pipeline is healthy now (literal timing, active-from-birth) so
  // the pessimistic covers are being re-sized against this device's floor.
  const headForVariant = (v: string): number =>
    v.startsWith("REPLACING")
      ? 0.18
      : v.startsWith("PUSHING")
        ? 0.1
        : v.startsWith("POPPING")
          ? 0.08
          : 0;
  // DESKTOP macOS Safari runs the same compiled clock (isDesktopMacWebKit) and
  // presents it from the main thread, so it needs the same active-from-birth
  // head — sized to ITS pipeline, not to a governor-throttled phone's. The LPM
  // numbers above cover 2-4 frames of a ~30Hz capped pipeline; a 60Hz desktop
  // frame is half as long, and the release update is lighter there (the settle
  // gate keeps it light and the atomic flip takes React's render and commit out
  // of the clock's way), so the cover is 2 frames for an entry and 1 for a pop —
  // the same shape of estimate, re-derived rather than inherited. These are a
  // FIRST estimate against the post-flip baseline; dial them here, on glass.
  // Two heads, two gates: a session is either touch (governed) or desktop Mac, never
  // both, and one shared attribute could not carry two head lengths — the timing
  // must stay LITERAL (var()/calc() timing lost WebKit's accelerated playback,
  // device-bisected 2026-08-13).
  const desktopHeadForVariant = (v: string): number =>
    v.startsWith("REPLACING")
      ? 0.033
      : v.startsWith("PUSHING")
        ? 0.033
        : v.startsWith("POPPING")
          ? 0.017
          : 0;
  // One emitter, two gates. The head is a flat lead-in baked into a copy of the
  // keyframes (`0%, head%` holds the from-pose), with the rule's duration
  // extended to match — the form that is active from birth, so WebKit's
  // accelerated commit happens during the invisible head instead of at the
  // animation's first visible frame.
  //
  // `shiftDelay` is the governed tier's extra: it ALSO pushes animation-delay out by
  // the head, so a governed flight sits still for two heads, not one. That is the
  // shipped, device-dialed behavior on touch (the numbers were walked down
  // against the felt result, so the doubling is baked into the value that was
  // chosen) and it is not this change's business to re-dial. The DESKTOP head is
  // derived from a measured latency instead, so it must cover that latency once:
  // a second head there is pure added lateness, which is the very complaint the
  // head exists to answer.
  const headBlock = (
    attribute: string,
    suffix: string,
    headS: number,
    shiftDelay: boolean,
    target: RideTarget = screenTarget
  ): string => {
    if (scope === "part") return "";
    if (headS <= 0 || duration <= 0) return "";
    if (authoredFromDecls.length === 0 && authoredToDecls.length === 0) return "";
    const total = duration + headS;
    const headPct = ((headS / total) * 100).toFixed(3);
    const kf = `${target.keyframe}-${suffix}`;
    const { fromDecls, toDecls } = target;
    const gatedSelector = target.selector
      .split(",\n")
      .map((one) => `:root[${attribute}] ${one}`)
      .join(",\n");
    return (
      `\n@keyframes ${kf} {\n  0%, ${headPct}% {\n${declsToBlock(fromDecls).replace(/^/gm, "  ")}\n  }\n  100% {\n${declsToBlock(toDecls).replace(/^/gm, "  ")}\n  }\n}\n` +
      `${gatedSelector} {\n  animation-name: ${kf};\n  animation-duration: ${total.toFixed(3)}s;\n  animation-delay: ${(shiftDelay ? delay + headS : delay).toFixed(3)}s;\n}`
    );
  };
  // Parts keep their own keyframes but ride the same head via a gated
  // LITERAL delay so the choreography's relative timing to the screens is
  // preserved on the governed tier.
  const partDelayBlock = (attribute: string, headS: number): string => {
    if (scope !== "part") return "";
    if (headS <= 0 || duration <= 0) return "";
    const gate = (extra = "") =>
      selector
        .split(",\n")
        .map((one) => `:root[${attribute}]${extra} ${one}`)
        .join(",\n");
    return `\n${gate()} {\n  animation-delay: ${(delay + headS).toFixed(3)}s;\n}`;
  };
  // The CREEP head (`:root[data-flemo-governed][data-flemo-creep]`).
  //
  // Device timelines (iPhone, 2026-08-20) put one dropped frame at the head's
  // LENGTH, not at any clock time: a 100ms head dropped the 6th frame after the
  // release, a 200ms head the 12th. That is the boundary where the flat head
  // stops repeating one pose and the value first moves — where WebKit appears
  // to commit the accelerated animation. Lengthening or shortening the head
  // only moves the drop with it (and shortening swallows the opening outright),
  // so the boundary itself has to go.
  //
  // The head's end keyframe therefore carries a translateZ hair instead of
  // repeating the start pose. A z translation with no perspective is visually
  // nothing — the screen can never peek out early — while the animated value
  // changes on every frame of the head, so the compositor is already carrying
  // this animation when the real motion begins. Measured: drops at the boundary
  // fell from 78% of pushes to 33%.
  const creepHeadBlockFor = (target: RideTarget = screenTarget) => {
    // A part variant returns before this block, and every head-carrying variant
    // has a duration — the guards mirror headBlock's so a future caller cannot
    // walk into a malformed keyframe.
    /* v8 ignore next */
    if (scope === "part") return "";
    const headS = headForVariant(variant);
    /* v8 ignore next */
    if (headS <= 0 || duration <= 0) return "";
    /* v8 ignore next -- same guard as headBlock's: a variant with nothing to
       animate never reaches a head. */
    if (authoredFromDecls.length === 0 && authoredToDecls.length === 0) return "";
    const creepDecls: CssDecl[] = (() => {
      const transform = target.fromDecls.find((decl) => decl.property === "transform");
      if (!transform) return [...target.fromDecls, { property: "transform", value: CREEP_NUDGE }];
      const base = transform.value === "none" ? "" : `${transform.value} `;
      return target.fromDecls.map((decl) =>
        decl.property === "transform"
          ? { property: "transform", value: `${base}${CREEP_NUDGE}` }
          : decl
      );
    })();
    const total = duration + headS;
    const headPct = ((headS / total) * 100).toFixed(3);
    const kf = `${target.keyframe}-${HEAD_SUFFIXES.creep}`;
    const gatedSelector = target.selector
      .split(",\n")
      .map((one) => `:root${attrSelector(GOVERNED_ATTR)}${attrSelector(CREEP_ATTR)} ${one}`)
      .join(",\n");
    return (
      `\n@keyframes ${kf} {\n  0% {\n${declsToBlock(target.fromDecls).replace(/^/gm, "  ")}\n  }\n  ${headPct}% {\n${declsToBlock(creepDecls).replace(/^/gm, "  ")}\n  }\n  100% {\n${declsToBlock(target.toDecls).replace(/^/gm, "  ")}\n  }\n}\n` +
      `${gatedSelector} {\n  animation-name: ${kf};\n  animation-duration: ${total.toFixed(3)}s;\n  animation-delay: ${(delay + headS).toFixed(3)}s;\n}`
    );
  };
  // Part delays are scope === "part" only, so they collapse to "" on the bar
  // copy and keep this list identical to the order the screen has always
  // emitted: governed head, governed part delay, creep head, desktop head,
  // desktop part delay.
  const headsFor = (target: RideTarget = screenTarget) =>
    headBlock(GOVERNED_ATTR, HEAD_SUFFIXES.governed, headForVariant(variant), true, target) +
    partDelayBlock(GOVERNED_ATTR, headForVariant(variant)) +
    creepHeadBlockFor(target) +
    headBlock(
      DESK_HEAD_ATTR,
      HEAD_SUFFIXES.desktop,
      desktopHeadForVariant(variant),
      false,
      target
    ) +
    partDelayBlock(DESK_HEAD_ATTR, desktopHeadForVariant(variant));

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
  // A PART IS NEVER PROMOTED, because in Safari the promotion is what breaks
  // it. `will-change` gives the element its own compositing layer, and a real
  // Safari (not the headless WebKit any automation drives, which composites
  // through a different path and shows none of this) then presents that layer
  // at its static opacity while the animation runs: device-measured on a
  // matched shared bar, the departing glyph held FULL colour through the whole
  // flight and was cut at unmount instead of fading, with `getComputedStyle`
  // reporting a perfectly interpolated 0.46 the entire time. Proved by
  // elimination on the device — one override, `[data-flemo-part-name] {
  // will-change: auto }`, and the same build cross-fades.
  //
  // Nothing is traded away. A screen is a full-viewport surface whose transform
  // runs for the whole flight, which is what the promotion was written for; a
  // part is a glyph or a label inside chrome that is already composited, so its
  // layer buys no frames and costs a correct hand-over.
  const willChangeDecl =
    scope !== "part" && animatedProperties.length > 0
      ? `  will-change: ${animatedProperties.join(", ")};\n`
      : "";

  // `contain: layout` confines layout invalidation inside the transitioning
  // scope, so a heavy arrival screen's reflow doesn't propagate up through
  // ancestors and steal time from the in-flight compositor animation.
  // Active-variant-scoped on purpose: it establishes a new containing block
  // for absolute/fixed descendants, which we only want during the
  // transition window (status flips back to IDLE/COMPLETED → rule stops
  // matching → containing block goes away, fixed bars re-anchor as before).
  //
  // Scoped to PUSHING and REPLACING only. Pop's arrival screen is unhidden
  // by ScreenFreeze (never re-mounted), so there's no mount work to isolate,
  // and the e2e harness showed a small but consistent regression (~8ms)
  // on heavy-DOM exiting screens during pop, attributable to containment
  // block evaluation cost on a 2k-node tree with no upside to offset it.
  const status = variant.split("-")[0];
  const wantsContainment = status === "PUSHING" || status === "REPLACING";
  // Keep the moving screen hit-testable. Pointer streams retain the element
  // selected at touch start; `pointer-events: none` sent a transition-adjacent
  // scroll to the covered screen and stranded it there until the user lifted.
  // React still suppresses click activation during these statuses, while
  // native scrolling can begin immediately on the destination.
  const containmentDecl = wantsContainment ? `  contain: layout;\n` : "";

  // The constants the keyframes no longer carry (see constantProperties): the
  // variant rule matches for exactly the window the animation runs, so the
  // element holds them throughout, and the keyframes stay composable.
  const constantDecl = constantDecls.length > 0 ? `${declsToBlock(constantDecls)}\n` : "";

  const ruleBlockFor = (target: RideTarget = screenTarget) =>
    `${target.selector} {\n  animation: ${animationPropFor(target.keyframe)};\n${delayDecl}${durationDecl}${constantDecl}${willChangeDecl}${containmentDecl}}`;

  // WHETHER THIS VARIANT PARKS, AND WHICH SIDE PARKS — decided ONCE.
  //
  // Everything below derives from these two, including the heads. The rule they
  // encode is not "which preset is this": a consumer authors their own
  // transitions and hides an entering screen however they like — a translate,
  // an opacity, a scale, whatever `targetHidesScreen` grows to recognise next —
  // and every park-shaped rule has to follow that one answer together. When the
  // park's conditions were restated at each rule, they drifted: the head added
  // in 2026-08 re-derived them and quietly excluded every opacity-authored
  // transition, so `layout` (the preset the shared-element bench runs on) parked
  // and then lost the park, while `cupertino` did not. A preset list would have
  // hidden that; a shared predicate cannot.
  const parkable = scope === "screen" && targetHidesScreen(fromValue) && authoredToDecls.length > 0;
  // The COVERED side ("-false"): it sits under the screen that is moving over
  // it, so its cover is a screen held on the same clock.
  const parksCovered = parkable && variant.endsWith("-false");
  // The ACTIVE ENTERING side of a push or replace. On a pop the active screen is
  // the LEAVING top, and parking that at its destination would expose the screen
  // returning underneath — a back-navigation flash.
  const parksEntering =
    parkable && variant.endsWith("-true") && (status === "PUSHING" || status === "REPLACING");

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
  const parkBlock = parksCovered
    ? `\n${screenSelector}${attrValueSelector(ANIM_HOLD_ATTR, ANIM_HOLD.PARK)} {\n  animation: none;\n${declsToBlock(
        authoredToDecls
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
  const parkUnderBlock = parksEntering
    ? `\n${screenSelector}${attrValueSelector(ANIM_HOLD_ATTR, ANIM_HOLD.PARK_UNDER)} {\n  animation: none;\n${declsToBlock(
        authoredToDecls
      )}\n}`
    : "";

  // park-over: hold the entering screen at its DESTINATION but ON TOP at a
  // near-zero opacity, so the browser genuinely PAINTS/composites its tiles
  // (giant image textures included) during the hold — the slide then rides the
  // cached composite instead of paying the first paint mid-flight. opacity last.
  const parkOverBlock = parksEntering
    ? `\n${screenSelector}${attrValueSelector(ANIM_HOLD_ATTR, ANIM_HOLD.PARK_OVER)} {\n  animation: none;\n${declsToBlock(
        authoredToDecls
      )}\n  opacity: ${PARK_OPACITY};\n}`
    : "";

  // PARK THROUGH THE HEAD — the same park, carried across the wait in front of
  // the curve.
  //
  // A head is a flat lead-in that holds the authored FROM-pose. For a screen
  // that parks, that pose is by definition one that hides it, and the park just
  // finished rasterizing the screen somewhere else — so the head undoes the park
  // the moment it starts, and the browser is free to drop what the park paid
  // for. On the governed tier the wait is `animation-delay` PLUS the head (the
  // delay is shifted by the head as well): 200ms on a push.
  //
  // Device-recorded (iOS Safari, 2026-08-30, 60fps frame analysis of a long
  // document pushed over a short list): the park painted the WHOLE entering
  // screen (full viewport height, at 0.02) for four frames, the screen then sat
  // invisible at its off-screen from-pose for nine, and the slide came up
  // carrying only the first ~512px tile row — its background painted, its text
  // absent — until a re-raster landed 183ms in, at 86% of the travel. A screen
  // shorter than one tile row fits inside the survivor, which is why this only
  // ever reads as a bug on a long one: the page appears to un-hide its overflow
  // when the transition ends.
  //
  // So the head holds the PARK pose instead. Same place the hold already had it,
  // for the same reason it was put there.
  //
  // WHY THIS IS DERIVED AND NOT RE-DECIDED: whether a screen parks is
  // `parksCovered` / `parksEntering` above, and this asks them rather than
  // re-deriving anything from the variant or the authored values. A consumer's
  // own transition hides its screens however it likes, and the two halves of one
  // decision must never be able to disagree about it.
  //
  // WHAT CONCEALS IT DIFFERS BY SIDE, and that is the one thing this has to know
  // on its own — because it has to survive the RELEASE, which the hold did not:
  //   - the entering side is concealed by the park's own near-zero opacity, and
  //     an opacity travels with the animation. It carries.
  //   - the covered side is concealed by the screen moving over it, which is
  //     held on the SAME clock and is therefore still in its own head. It
  //     carries too, and needs no opacity of its own — leaving the authored
  //     values alone.
  //   - park-UNDER is concealed by a z-index the binding drops at the release,
  //     so it cannot carry. The binding writes the attribute only for the two
  //     that can (see PARK_HEAD_ATTR); nothing here has to know that.
  //
  // The jump from the park pose to the from-pose is split into slivers that are
  // each invisible for their own reason: the move happens while the screen is
  // still at the park's opacity, and the opacity is restored once it is already
  // hidden. No frame can land on a half-parked pose.
  const parkHeadBlock = (
    attribute: string,
    suffix: string,
    headS: number,
    shiftDelay: boolean
  ): string => {
    if (!parksCovered && !parksEntering) return "";
    /* v8 ignore next -- every parking variant is a PUSHING/REPLACING/POPPING
       screen, so it has both a head and a duration; the guard mirrors
       headBlock's so a future caller cannot walk into a malformed keyframe. */
    if (headS <= 0 || duration <= 0) return "";

    const total = duration + headS;
    const headPct = (headS / total) * 100;
    // Each sliver is 0.05% of the total — a quarter of a millisecond at the
    // shipped lengths, well inside one frame at any refresh rate this runs on.
    // Proportional below that, so an unusually long authored duration shrinks
    // them rather than pushing the first stop past 0%.
    const sliver = Math.min(0.05, headPct / 4);
    const kf = `${keyframe}-${suffix}`;
    // The entering side's concealment, and the only value this rule writes that
    // the author did not: the same `opacity` the park-over hold already applies,
    // held for the same reason.
    const conceal = parksEntering ? `    opacity: ${PARK_OPACITY};` : "";
    // RELEASING IT IS NOT THE SAME AS SETTING IT TO 1, and getting that wrong
    // rewrites the author's motion. Where a transition animates opacity itself —
    // `layout`, and every consumer fade — the from-pose already carries the
    // author's own value, so the concealment is released simply by stopping:
    // the authored decls take over and the fade runs from where it was written
    // to run from. Forcing 1 there landed the screen fully opaque on the frame
    // after the head and deleted the fade outright (WebKit-measured: opacity 1.0
    // at 217ms where the authored curve is at 0.20).
    //
    // Only a transition that declares NO opacity needs the release spelled out,
    // because there its `0.02` has nothing authored to fall back to.
    const authorsOpacity = [...fromDecls, ...toDecls].some((d) => d.property === "opacity");
    const release = parksEntering && !authorsOpacity ? `    opacity: 1;` : "";
    // An injected opacity REPLACES the author's at that stop rather than
    // trailing it: `opacity: 1; opacity: 0.02` resolves the same way, but only
    // one of the two is ever the value and the sheet should say so.
    const at = (pct: number, decls: CssDecl[], opacity: string) => {
      const kept = opacity ? decls.filter((decl) => decl.property !== "opacity") : decls;
      // A pose can be nothing BUT its opacity — a fade's from-pose is exactly
      // that — so the authored block has to drop out of the stop rather than
      // leave a blank line where its only declaration was.
      const lines = [
        ...(kept.length > 0 ? [declsToBlock(kept).replace(/^/gm, "  ")] : []),
        ...(opacity ? [opacity] : [])
      ];
      return `  ${pct.toFixed(3)}% {\n${lines.join("\n")}\n  }`;
    };
    return (
      `\n@keyframes ${kf} {\n` +
      `${at(0, toDecls, conceal)}\n` +
      `${at(headPct - sliver, toDecls, conceal)}\n` +
      `${at(headPct, fromDecls, conceal)}\n` +
      (parksEntering ? `${at(headPct + sliver, fromDecls, release)}\n` : "") +
      `${at(100, toDecls, release)}\n` +
      `}\n` +
      `:root${attrSelector(attribute)} ${screenSelector}${attrValueSelector(PARK_HEAD_ATTR, "true")} {\n` +
      `  animation-name: ${kf};\n` +
      `  animation-duration: ${total.toFixed(3)}s;\n` +
      `  animation-delay: ${(shiftDelay ? delay + headS : delay).toFixed(3)}s;\n` +
      (parksEntering
        ? `  will-change: ${[...new Set([...animatedProperties, "opacity"])].join(", ")};\n`
        : "") +
      `}`
    );
  };

  // One parked copy per head the sheet emits, in the same order and by the same
  // rule as `headsFor`: a head that holds an entering screen away from its park
  // has this defect, and how long it holds it only decides how visible it is.
  const parkHeadsFor = () =>
    parkHeadBlock(GOVERNED_ATTR, HEAD_SUFFIXES.governedPark, headForVariant(variant), true) +
    parkHeadBlock(DESK_HEAD_ATTR, HEAD_SUFFIXES.desktopPark, desktopHeadForVariant(variant), false);

  // The bar's corrected copy carries the same heads for the same reason the
  // screen does: a rider that keeps the screen's clock but loses the governed
  // or desktop lead-in would start moving before the screen it belongs to.
  // Park blocks stay screen-only, as they always were: they hold a SCREEN at
  // its destination to pre-rasterize it, and a bar is not what is being
  // rasterized.
  const barBlock = needsRideCopy
    ? `\n${keyframeBlockFor(barTarget)}\n${ruleBlockFor(barTarget)}${headsFor(barTarget)}`
    : "";

  return `${keyframeBlock}\n${ruleBlockFor()}${headsFor()}${parkHeadsFor()}${parkBlock}${parkUnderBlock}${parkOverBlock}${barBlock}`;
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
  // Materialized because the decorator pass walks the transitions a second
  // time, and the callers hand this in as a Map's `.values()` iterator.
  const transitionList = [...transitions];
  const decoratorByName = new Map<string, Decorator>();
  for (const decorator of decorators) decoratorByName.set(decorator.name, decorator);

  for (const transition of transitionList) {
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

  // ONE PASS PER (TRANSITION x DECORATOR) PAIR, not one per decorator name.
  //
  // A decorator's clock is the clock of the transition that names it, so the
  // same decorator reached from two transitions is two different compiled
  // results. Driving the loop from the transitions is also what makes the pair
  // reachable at all: `decoratorName` points one way only.
  //
  // A registered decorator that no transition names emits nothing now, where
  // it used to emit a full rule set. Nothing is lost: a decorator element is
  // only ever rendered for a screen whose transition names it, so those rules
  // could never match anything.
  for (const transition of transitionList) {
    if (!transition.decoratorName) continue;
    const decorator = decoratorByName.get(transition.decoratorName);
    if (!decorator) continue;

    const resolved = resolveDecoratorClock(transition, decorator);
    const pairName = `${transition.name}--${decorator.name}`;
    const selectorBuilder = (_: string, pairVariant: TransitionVariant) =>
      restDecoratorSelector(transition.name, decorator.name, pairVariant);

    for (const variant of DECORATOR_VARIANTS) {
      const variantValue = resolved.variants[variant];
      const fromKey = FROM_VARIANT[variant];

      if (fromKey === "self") {
        blocks.push(compileRestBlock(selectorBuilder, pairName, variant, variantValue));
        continue;
      }

      const fromValue = fromKey === "initial" ? resolved.initial : resolved.variants[fromKey].value;

      blocks.push(
        compileVariantBlock(
          "decorator",
          pairName,
          variant,
          fromValue,
          variantValue,
          selectorBuilder
        )
      );
    }
  }

  // Materialized because the pair pass below walks the parts a second time, and
  // the callers hand this in as a Map's `.values()` iterator.
  const partList = [...partTransitions];

  for (const partTransition of partList) {
    const name = partTransition.name;
    // Normalized, not inherited: this is the rule a part with no transition
    // matches, and there is no flight above it to take a clock from. Passing it
    // through the same resolver is what keeps the optional shape from reaching
    // the emitter.
    const byName = resolvePartClock(null, partTransition);

    for (const variant of DECORATOR_VARIANTS) {
      const variantValue = byName.variants[variant];
      const fromKey = FROM_VARIANT[variant];

      if (fromKey === "self") {
        blocks.push(compileRestBlock(partSelector, name, variant, variantValue));
        continue;
      }

      const fromValue = fromKey === "initial" ? byName.initial : byName.variants[fromKey].value;

      blocks.push(
        compileVariantBlock("part", name, variant, fromValue, variantValue, partSelector)
      );
    }
  }

  // ONE PASS PER (TRANSITION x PART) PAIR, on top of the by-name pass above.
  //
  // A part declares a POSE; how long it takes is the flight's answer, and the
  // flight already gave it. Before this, an omitted duration resolved to zero
  // and the part SNAPPED under a screen that ran for three quarters of a
  // second — and a part authored LONGER than its screen held the whole flight
  // open (statusChoreographySpanMs), which disables swipe-back for as long as
  // it runs. The by-name pass stays: it is what a part mounted outside any
  // screen matches, and that one has no transition to inherit from.
  for (const transition of transitionList) {
    for (const part of partList) {
      const resolved = resolvePartClock(transition, part);
      const selectorBuilder = (_: string, pairVariant: TransitionVariant) =>
        partPairSelector(transition.name, part.name, pairVariant);

      for (const variant of DECORATOR_VARIANTS) {
        const variantValue = resolved.variants[variant];
        const fromKey = FROM_VARIANT[variant];

        if (fromKey === "self") {
          blocks.push(compileRestBlock(selectorBuilder, part.name, variant, variantValue));
          continue;
        }

        const fromValue =
          fromKey === "initial" ? resolved.initial : resolved.variants[fromKey].value;

        // The BASE part name, so the pair reuses the by-name keyframes rather
        // than minting a set per transition: the pose is the same, only the
        // clock differs, and the clock lives in the rule. dedupeKeyframeBlocks
        // drops what that repetition emits.
        blocks.push(
          compileVariantBlock("part", part.name, variant, fromValue, variantValue, selectorBuilder)
        );
      }
    }
  }

  return dedupeKeyframeBlocks(
    [...blocks.filter((b) => b.length > 0), ANIM_HOLD_RULE, ARRIVAL_HOLD_RULE].join("\n\n")
  );
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
  // One selector per paused form, then the same set again scoped to the
  // <Part> and morph elements inside a held carrier. A morph's keyframes are
  // emitted per flight rather than compiled, but its CLOCK is the same one
  // every other participant obeys — which is the whole reason a shared element
  // starts on the same frame as the screen carrying it, with no timing code on
  // either side.
  [
    ...ANIM_HOLD_PAUSED_VALUES.map((value) => attrValueSelector(ANIM_HOLD_ATTR, value)),
    ...ANIM_HOLD_PAUSED_VALUES.flatMap((value) => [
      `${attrValueSelector(ANIM_HOLD_ATTR, value)} ${attrSelector(PART_NAME_ATTR)}`,
      `${attrValueSelector(ANIM_HOLD_ATTR, value)} ${attrSelector(MORPH_ATTR)}`,
      // The GHOST too. It is deliberately stripped of every morph marker so
      // nothing mistakes the copy for the real element — which also took it
      // out of the rule above, and a copy that dissolves while the flight is
      // still held is an afterimage of the thing that has not moved yet.
      `${attrValueSelector(ANIM_HOLD_ATTR, value)} ${attrSelector(MORPH_GHOST_ATTR)}`
    ])
  ].join(",\n") + " {",
  `  animation-play-state: paused !important;`,
  `}`
].join("\n");

// NOTE (consumer-animation quarantine, removed): a rule used to live here that
// set `animation: none !important` on every non-<Part> descendant (and its
// `::before`/`::after`) of a navigation's cold entering screens, to prevent a
// storm of consumer animation layers from committing during the flight. It
// manipulated animations the consumer authored — skeleton shimmers, ambient
// loops — which is not the library's call to make. Consumer animations now run
// exactly as written, transitions or not.

// In-flight commit hold (see core/engine/arrivalHold.ts): content that
// arrives inside a screen DURING its transition is held off-glass and
// reflected in one commit at rest, so a mid-flight Suspense swap can never
// punch through a decelerating motion. The engine stamps the attribute; this
// rule is the entire visual mechanism.
const ARRIVAL_HOLD_RULE = [
  `${attrSelector(HELD_ARRIVAL_ATTR)} {`,
  `  display: none !important;`,
  `}`
].join("\n");

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

  // The same test the compiler applies: a variant whose endpoints agree on
  // every property emits a rest rule, not an animation, so nothing on it will
  // ever fire `animationend` and it must not be counted as a participant.
  return declsInterpolate(targetToDecls(fromValue), targetToDecls(variantValue.value));
};

// Engine-shared head lengths (ms) for the DESKTOP flat-head keyframes above —
// the desktop macOS Safari tier's own cover, derived from a 60Hz pipeline (two
// frames for an entry, one for a pop) rather than inherited from the governed table.
// Same contract: the engine's wall-clock deadlines must ride the head.
export const DESKTOP_HEAD_MS: Record<string, number> = {
  REPLACING: 33,
  PUSHING: 33,
  POPPING: 17
};

// Engine-shared head lengths (ms) for the governed flat-head keyframes above:
// wall-clock deadlines (watchdog, cut) must ride the head.
export const GOVERNED_HEAD_MS: Record<string, number> = {
  REPLACING: 180,
  PUSHING: 100,
  POPPING: 80
};
