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

const CREEP_NUDGE = "translateZ(0.02px)";

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

// ---- LPM front-softening: compile-time, per authored curve ----
//
// Under iOS Low Power Mode the main pipeline runs ~30Hz, so a curve that
// packs half its travel into the first ~20% of its duration crosses the
// opening in 5-6 presented frames — faster than the eye locks on (the
// device-judged "60-100 jump"). For every SCREEN-scope rule the compiler
// pre-computes a softened variant of ITS OWN authored curve and emits it
// behind a `:root[data-flemo-lpm]` gate the engine toggles: no runtime
// math, no one-size-fits-all override, and a curve that is not
// front-loaded (ease-in, linear, gentle ease-out…) is left exactly as
// authored. Softening blends the control points toward a device-judged
// reference in proportion to how front-loaded the curve actually is —
// cupertino (half travel at x≈0.17) maps to the full reference, milder
// curves move proportionally less.
const KEYWORD_BEZIERS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1]
};

const parseBezierCss = (css: string): [number, number, number, number] | null => {
  const keyword = KEYWORD_BEZIERS[css];
  if (keyword) return keyword;
  const match = css.match(/^cubic-bezier\(([^)]+)\)$/);
  if (!match) return null; // linear, steps(), springs: never softened
  const parts = match[1]!.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts as unknown as [number, number, number, number];
};

// The x (time fraction) at which the curve reaches half its travel, from
// the parametric form — sampled once at compile time.
const halfTravelX = ([x1, y1, x2, y2]: [number, number, number, number]): number => {
  let prevX = 0;
  let prevY = 0;
  for (let i = 1; i <= 100; i += 1) {
    const t = i / 100;
    const mt = 1 - t;
    const x = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
    const y = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
    if (y >= 0.5) {
      const f = (0.5 - prevY) / (y - prevY || 1);
      return prevX + (x - prevX) * f;
    }
    prevX = x;
    prevY = y;
  }
  return 1;
};

// Device-judged reference (iPhone LPM, 2026-08-12): the softened cupertino.
const SOFT_REFERENCE: [number, number, number, number] = [0.4, 0.3, 0.1, 1];
// Half travel later than this: the curve is not front-loaded — untouched.
const FRONT_LOAD_ONSET_X = 0.3;
// Cupertino-grade front-loading maps to the full reference blend.
const FULL_SOFTEN_X = 0.19;

// Whoosh is an ABSOLUTE-time phenomenon (the eye needs ~350ms to lock on
// moving content), so the gate reads the front segment's absolute span,
// not its fraction: a 10s authored curve that reaches half travel in 1.7s
// is perfectly trackable however front-loaded its SHAPE is, and must stay
// exactly as authored.
const HALF_TRAVEL_TRACKABLE_MS = 350;
const HALF_TRAVEL_FULL_SOFTEN_MS = 120;

export const softenFrontLoadedEasing = (easingCss: string, durationS: number): string | null => {
  const bezier = parseBezierCss(easingCss);
  if (!bezier || durationS <= 0) return null;
  const halfX = halfTravelX(bezier);
  if (halfX >= FRONT_LOAD_ONSET_X) return null;
  const halfTimeMs = halfX * durationS * 1000;
  if (halfTimeMs >= HALF_TRAVEL_TRACKABLE_MS) return null;
  const shapeW = Math.min((FRONT_LOAD_ONSET_X - halfX) / (FRONT_LOAD_ONSET_X - FULL_SOFTEN_X), 1);
  const timeW = Math.min(
    (HALF_TRAVEL_TRACKABLE_MS - halfTimeMs) /
      (HALF_TRAVEL_TRACKABLE_MS - HALF_TRAVEL_FULL_SOFTEN_MS),
    1
  );
  const w = shapeW * timeW;
  const soft = bezier.map(
    (value, i) => Math.round((value + (SOFT_REFERENCE[i]! - value) * w) * 1000) / 1000
  );
  return `cubic-bezier(${soft.join(", ")})`;
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

// A head tier plays the SAME flight under a copied keyframe set, so its
// `animationend` / `animationcancel` events carry a suffixed name. Every
// listener that matches a flight by name must accept all of them — a listener
// that recognizes only the base name silently stops resolving the flight, and
// the restart watchdog then replays the whole transition (glass-visible as a
// second fade on REPLACE). Keep this list beside the suffixes the compiler
// emits, and route every name comparison through the matcher.
export const HEAD_ANIMATION_SUFFIXES = ["-lpm", "-deskhead", "-lpmcreep"] as const;

export const matchesFlightAnimationName = (eventName: string, expectedName: string): boolean =>
  eventName === expectedName ||
  HEAD_ANIMATION_SUFFIXES.some((suffix) => eventName === `${expectedName}${suffix}`);

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

  // LPM overrides, consumed as longhand declarations after the shorthand.
  // Both vars are published by the engine before the release and stay unset
  // (fallbacks: 0ms / 1) everywhere else — pure style, resolved at the
  // animation's own birth: no WAAPI touch, so WebKit's accelerated
  // (out-of-process) playback is never at risk.
  //
  // --flemo-lpm-birth-hold: a compiled clock is born at the release
  // update's style resolution but its first frame reaches the glass only
  // after that update's paint and the compositor's commit — under iOS Low
  // Power Mode (main pipeline ~30Hz) that's 2-3 frames of aging, so the
  // first PRESENTED frame sits 25-40% into a fast curve: the device-
  // reported "starts at 60" jump. The engine predicts that latency (see
  // lowPowerCadence) and the delay moves the clock's zero to the first
  // presented frame while fill-mode `both` (backwards) holds the authored
  // from-pose — the same pose the hold already shows.
  //
  // --flemo-lpm-stretch: the user-selected LPM time dilation, applied to
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
  // calc(var(--flemo-lpm-*)) plumbing) lost WebKit's compositor playback
  // and collapsed to a 2-frame snap under main-thread starvation, while
  // literalizing EITHER property restored a fully presented fade. The LPM
  // birth hold and REPLACING stretch are applied by the ENGINE as inline
  // literal longhands on the participants instead (pre-birth, style-only).
  const delayDecl = "";
  const durationDecl = "";
  // LPM front-softening (see softenFrontLoadedEasing): SCREEN scope (and
  // its riding bar) only — parts keep their authored per-element easing so
  // choreography internals never re-time. Emitted as a separate rule behind
  // the engine-toggled `:root[data-flemo-lpm]` gate; nothing changes for
  // any other session.
  // A/B 2026-08-13: softening RETIRED (flag off) — it was prescribed
  // against the broken pipeline (var-timing demotion + opening skips), and
  // with those cured the softened curve is itself the "different
  // transition" the user senses vs the player's authored iOS curve. Flip
  // the flag to re-arm if the whoosh returns.
  const LPM_SOFTEN_ENABLED = false;
  const softened =
    LPM_SOFTEN_ENABLED && scope === "screen" ? softenFrontLoadedEasing(easing, duration) : null;
  const softenedBlock =
    softened !== null
      ? `\n${selector
          .split(",\n")
          .map((one) => `:root[data-flemo-lpm] ${one}`)
          .join(",\n")} {\n  animation-timing-function: ${softened};\n}`
      : "";

  // LPM REPLACING: the hold lives INSIDE the keyframes as a flat head,
  // not in animation-delay. Device-chased to the end (2026-08-13): with a
  // delay-based hold the fade-start starvation rode the delay expiry at
  // every hold size — WebKit commits the accelerated animation only when
  // the ACTIVE phase begins, and that layerization is the ~100ms cliff on
  // a governor-throttled phone. A flat-head keyframe form is active from
  // birth: the accelerated commit happens during the (invisible) held
  // head, the UI process then plays the whole fade autonomously, and the
  // authored from→to curve is reproduced exactly after the head. Static,
  // literal, gate-scoped — the engine only raises data-flemo-lpm.
  // Per-status head lengths, shared with the engine's deadline math (see
  // LPM_HEAD_MS below). REPLACING's 0.35 is the device-verified value that
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
  // DESKTOP macOS Safari runs the same compiled clock (joinPlayer gate 3) and
  // presents it from the main thread, so it needs the same active-from-birth
  // head — sized to ITS pipeline, not to a governor-throttled phone's. The LPM
  // numbers above cover 2-4 frames of a ~30Hz capped pipeline; a 60Hz desktop
  // frame is half as long, and the release update is lighter there (the settle
  // gate keeps it light and the atomic flip takes React's render and commit out
  // of the clock's way), so the cover is 2 frames for an entry and 1 for a pop —
  // the same shape of estimate, re-derived rather than inherited. These are a
  // FIRST estimate against the post-flip baseline; dial them here, on glass.
  // Two heads, two gates: a session is either touch (LPM) or desktop Mac, never
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
  // `shiftDelay` is the LPM tier's extra: it ALSO pushes animation-delay out by
  // the head, so an LPM flight sits still for two heads, not one. That is the
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
    shiftDelay: boolean
  ): string => {
    if (scope === "part") return "";
    if (headS <= 0 || duration <= 0) return "";
    if (fromDecls.length === 0 && toDecls.length === 0) return "";
    const total = duration + headS;
    const headPct = ((headS / total) * 100).toFixed(3);
    const kf = `${keyframe}-${suffix}`;
    const gatedSelector = selector
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
  // preserved under LPM.
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
  // The CREEP head (`flemo:creep`, `:root[data-flemo-lpm][data-flemo-creep]`).
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
  const creepHeadBlock = (() => {
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
    if (fromDecls.length === 0 && toDecls.length === 0) return "";
    const creepDecls: CssDecl[] = (() => {
      const transform = fromDecls.find((decl) => decl.property === "transform");
      if (!transform) return [...fromDecls, { property: "transform", value: CREEP_NUDGE }];
      const base = transform.value === "none" ? "" : `${transform.value} `;
      return fromDecls.map((decl) =>
        decl.property === "transform"
          ? { property: "transform", value: `${base}${CREEP_NUDGE}` }
          : decl
      );
    })();
    const total = duration + headS;
    const headPct = ((headS / total) * 100).toFixed(3);
    const kf = `${keyframe}-lpmcreep`;
    const gatedSelector = selector
      .split(",\n")
      .map((one) => `:root[data-flemo-lpm][data-flemo-creep] ${one}`)
      .join(",\n");
    return (
      `\n@keyframes ${kf} {\n  0% {\n${declsToBlock(fromDecls).replace(/^/gm, "  ")}\n  }\n  ${headPct}% {\n${declsToBlock(creepDecls).replace(/^/gm, "  ")}\n  }\n  100% {\n${declsToBlock(toDecls).replace(/^/gm, "  ")}\n  }\n}\n` +
      `${gatedSelector} {\n  animation-name: ${kf};\n  animation-duration: ${total.toFixed(3)}s;\n  animation-delay: ${(delay + headS).toFixed(3)}s;\n}`
    );
  })();
  const lpmHeadBlock = headBlock("data-flemo-lpm", "lpm", headForVariant(variant), true);
  const lpmPartDelayBlock = partDelayBlock("data-flemo-lpm", headForVariant(variant));
  const deskHeadBlock = headBlock(
    "data-flemo-desk-head",
    "deskhead",
    desktopHeadForVariant(variant),
    false
  );
  const deskPartDelayBlock = partDelayBlock("data-flemo-desk-head", desktopHeadForVariant(variant));

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

  const ruleBlock = `${selector} {\n  animation: ${animationProp};\n${delayDecl}${durationDecl}${willChangeDecl}${containmentDecl}}`;

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

  // park-over: hold the entering screen at its DESTINATION but ON TOP at a
  // near-zero opacity, so the browser genuinely PAINTS/composites its tiles
  // (giant image textures included) during the hold — the slide then rides the
  // cached composite instead of paying the first paint mid-flight. opacity last.
  const parkOverBlock =
    scope === "screen" &&
    variant.endsWith("-true") &&
    (variant.startsWith("PUSHING") || variant.startsWith("REPLACING")) &&
    targetHidesScreen(fromValue) &&
    toDecls.length > 0
      ? `\n${screenSelector}[data-flemo-anim-hold="park-over"] {\n  animation: none;\n${declsToBlock(
          toDecls
        )}\n  opacity: 0.02;\n}`
      : "";

  return `${keyframeBlock}\n${ruleBlock}${softenedBlock}${lpmHeadBlock}${lpmPartDelayBlock}${creepHeadBlock}${deskHeadBlock}${deskPartDelayBlock}${parkBlock}${parkUnderBlock}${parkOverBlock}`;
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

  return [...blocks.filter((b) => b.length > 0), ANIM_HOLD_RULE, ARRIVAL_HOLD_RULE].join("\n\n");
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
  `[data-flemo-anim-hold="park-over"],`,
  `[data-flemo-anim-hold="true"] [data-flemo-part-name],`,
  `[data-flemo-anim-hold="park"] [data-flemo-part-name],`,
  `[data-flemo-anim-hold="park-under"] [data-flemo-part-name],`,
  `[data-flemo-anim-hold="park-over"] [data-flemo-part-name] {`,
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

// Engine-shared head lengths (ms) for the DESKTOP flat-head keyframes above —
// the desktop macOS Safari tier's own cover, derived from a 60Hz pipeline (two
// frames for an entry, one for a pop) rather than inherited from the LPM table.
// Same contract: the engine's wall-clock deadlines must ride the head.
export const DESKTOP_HEAD_MS: Record<string, number> = {
  REPLACING: 33,
  PUSHING: 33,
  POPPING: 17
};

// Engine-shared head lengths (ms) for the LPM flat-head keyframes above:
// wall-clock deadlines (watchdog, cut) must ride the head.
export const LPM_HEAD_MS: Record<string, number> = {
  REPLACING: 180,
  PUSHING: 100,
  POPPING: 80
};
