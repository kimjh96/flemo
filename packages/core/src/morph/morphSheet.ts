import type { DeclaredFrame } from "@transition/gestureScrub";

import isServer from "@utils/isServer";

import { MORPH_SHEET_ATTR } from "@dom/attributes";

import { PINNED_POSE_PROPERTY_RULES } from "@morph/morphPose";

// The per-flight keyframe sheet.
//
// Every other animation in flemo is compiled once from its definition, because
// every other animation is fully known before a navigation starts. A morph is
// not: how far the element travels and how much it grows are two rects that
// only exist once the arriving screen has laid out. So its keyframes are
// inserted at the flight's start, with LITERAL values — no `var()` in the
// keyframe, which is the same discipline the compiled sheet keeps for its
// timing — and dropped when the flight lands.
//
// Insertion goes through CSSOM rather than rewriting `textContent`: a flight
// starts inside a layout effect, one style recalculation away from the frame
// the user sees, and re-parsing the whole sheet there is work the flight would
// pay for.
//
// The one exception to "literal" is a PINNED pose, which is driven through
// registered custom properties precisely so that no compositor can run it, and
// therefore stays with the rest of the flight (see morphPose). Those
// registrations live below, and unlike a flight's own rules they are never
// dropped.
const sheet = (): CSSStyleSheet | null => {
  if (isServer()) return null;
  let tag = document.head.querySelector<HTMLStyleElement>(`style[${MORPH_SHEET_ATTR}]`);
  if (!tag) {
    tag = document.createElement("style");
    tag.setAttribute(MORPH_SHEET_ATTR, "");
    document.head.appendChild(tag);
  }
  return tag.sheet;
};

/**
 * Insert one flight's rules and return the disposer that removes exactly them.
 *
 * The rules are tracked by identity, not by index: a concurrent flight (two
 * morphing elements in one navigation, or a second navigation interrupting the
 * first) inserts and drops rules in between, and an index captured at insertion
 * would by then point at someone else's keyframes.
 */
export const insertMorphRules = (rules: string[]): (() => void) => {
  const target = sheet();
  if (!target) return () => {};

  const inserted: CSSRule[] = [];
  for (const rule of rules) {
    try {
      const index = target.insertRule(rule, target.cssRules.length);
      const cssRule = target.cssRules[index];
      if (cssRule) inserted.push(cssRule);
      /* v8 ignore next 4 -- a malformed rule is a bug in the emitter, not a
         runtime condition; the guard exists so one bad rule cannot leave a
         flight without its cleanup. */
    } catch {
      // Keep going: a partially inserted flight still cleans up below.
    }
  }

  return () => {
    for (const cssRule of inserted) {
      const index = Array.prototype.indexOf.call(target.cssRules, cssRule);
      if (index >= 0) target.deleteRule(index);
    }
    inserted.length = 0;
  };
};

// REGISTERED ONCE, AND KEPT.
//
// `@property` is a document-wide registration, and adding or removing one
// invalidates style for everything — which is the single frame a flight has the
// least room in. So the pose's five go in on the first flight that needs them
// and stay there for the session: five declarations, and no churn on any flight
// after the first.
//
// Keyed by the sheet rather than by a module flag so a second document (a test,
// an iframe) registers into its own.
const registered = new WeakMap<CSSStyleSheet, boolean>();

/**
 * Register the pinned pose's custom properties, and report whether they took.
 *
 * A browser that does not understand `@property` refuses the rule, and there
 * every pose has to stay literal: unregistered, those properties would animate
 * discretely and teleport a pose at its midpoint rather than interpolating it.
 * A part that leads the rest of its flight is a flaw; one that jumps is a break.
 */
export const ensurePinnedPoses = (): boolean => {
  const target = sheet();
  /* v8 ignore next -- no document to register into. */
  if (!target) return false;
  const seen = registered.get(target);
  if (seen !== undefined) return seen;
  let took = true;
  for (const rule of PINNED_POSE_PROPERTY_RULES) {
    try {
      target.insertRule(rule, target.cssRules.length);
    } catch {
      took = false;
    }
  }
  registered.set(target, took);
  return took;
};

// READING THE FLIGHT BACK OUT.
//
// A gesture's release has to stage the return of a flight it did not compile,
// which means reading the path back. `getKeyframes()` looks like the way to do
// that and is not: Chromium answers a CSS animation with the offsets and the
// curves and none of the custom properties, and a pinned pose — the whole box
// travel — lives in exactly those. The sheet the rules went into does have
// them, and it is right here.

/** `0%` → 0, `from` → 0, `to` → 1. Anything else is not an offset. */
const offsetOf = (keyText: string): number | null => {
  const key = keyText.trim();
  if (key === "from") return 0;
  if (key === "to") return 1;
  if (!key.endsWith("%")) return null;
  const percent = Number.parseFloat(key.slice(0, -1));
  return Number.isFinite(percent) ? percent / 100 : null;
};

/** Split a CSS list on its top-level commas — `cubic-bezier()` carries its own. */
const splitList = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
};

const TIMING_FUNCTION = "animation-timing-function";

/**
 * The curve the animation itself carries, which its keyframes inherit.
 *
 * A flight's rule names both, so the rule that names the animation is where it
 * is read from; the flyer's own set is written inline instead, as a shorthand
 * list, so there it is matched by position against the names.
 */
const declaredEasing = (
  rules: readonly CSSRule[],
  name: string,
  target: HTMLElement
): string | null => {
  for (const rule of rules) {
    const style = (rule as CSSStyleRule).style;
    if (!style || typeof style.getPropertyValue !== "function") continue;
    if (style.getPropertyValue("animation-name").trim() === name) {
      const easing = style.getPropertyValue(TIMING_FUNCTION).trim();
      if (easing) return easing;
    }
  }
  const names = splitList(target.style.getPropertyValue("animation-name"));
  const index = names.indexOf(name);
  if (index < 0) return null;
  const easings = splitList(target.style.getPropertyValue(TIMING_FUNCTION));
  /* v8 ignore next -- a name with no curve beside it is not something the
     emitters produce; the caller declines rather than guessing one. */
  if (easings.length === 0 || !easings[0]) return null;
  // A shorter list repeats, which is what CSS does with any animation longhand.
  return easings[index % easings.length]!;
};

/**
 * One flight's compiled path, as its emitter wrote it.
 *
 * `null` when the rules are not this sheet's to read — an animation from
 * somewhere else, or a flight whose rules have already been dropped — and the
 * caller falls back to what the animation itself reports.
 */
export const declaredMorphKeyframes = (animation: Animation): DeclaredFrame[] | null => {
  const target = (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null;
  const name = (animation as unknown as { animationName?: unknown }).animationName;
  if (!target || typeof name !== "string" || !name) return null;
  const owner = sheet();
  /* v8 ignore next -- no document to read from. */
  if (!owner) return null;
  let rules: readonly CSSRule[];
  try {
    rules = [...owner.cssRules];
    /* v8 ignore next 3 -- a sheet that refuses to be read is not one of ours,
       but the read is guarded because the CSSOM makes it throwable. */
  } catch {
    return null;
  }

  const blocks = rules.find(
    (rule): rule is CSSKeyframesRule =>
      (rule as CSSKeyframesRule).name === name && (rule as CSSKeyframesRule).cssRules != null
  );
  if (!blocks) return null;
  const inherited = declaredEasing(rules, name, target);
  if (!inherited) return null;

  const frames: DeclaredFrame[] = [];
  for (const block of [...blocks.cssRules] as CSSKeyframeRule[]) {
    const style = block.style;
    /* v8 ignore next -- every block of a `@keyframes` rule has declarations. */
    if (!style) return null;
    const own = style.getPropertyValue(TIMING_FUNCTION).trim();
    const pose: Record<string, string> = {};
    for (let index = 0; index < style.length; index++) {
      const property = style.item(index);
      if (property === TIMING_FUNCTION) continue;
      pose[property] = style.getPropertyValue(property).trim();
    }
    for (const key of splitList(block.keyText)) {
      const offset = offsetOf(key);
      if (offset === null) return null;
      frames.push({ offset, easing: own || inherited, pose });
    }
  }
  if (frames.length < 2) return null;
  // Blocks come back in the order they were written, which for a landing that
  // arrives before it lands is not the order they are played in.
  frames.sort((left, right) => left.offset - right.offset);
  return frames;
};
