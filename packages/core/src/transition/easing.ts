import type { AnimationOptions } from "@transition/cssTypes";

/**
 * WHAT AN AUTHORED EASE IS, in one place.
 *
 * There were two tables. The keyframes compiler kept names to CSS strings and
 * the sampler kept the same names to control points, with a comment on the
 * second promising it mirrored the first "exactly". That promise is the same
 * kind this repository has been bitten by elsewhere: prose holding two pieces
 * of code together, with nothing to break when they drift.
 *
 * They also shared a hole. `AnimationEasing` accepts a string, and both tables
 * were total lookups with a fallback: a name they did not know became `ease`,
 * silently, in both. So every CSS easing a web author would actually type —
 *
 *   "ease-out"              the CSS spelling of a name the table only had as `easeOut`
 *   "cubic-bezier(...)"     the same curve an array expresses, written out
 *   "steps(4, end)"
 *   "linear(0, .3, .8, 1)"  which is how a spring ships in CSS
 *
 * — typechecked, compiled to `ease`, and animated something the author never
 * wrote. Found while fitting a measured spring for the card-open playground
 * page: the `linear()` form was the obvious way to carry it and would have
 * produced a completely different motion with nothing said.
 */

// The named eases flemo has always accepted, in motion's spelling, plus the CSS
// spellings of the three that have one. Control points are the source; the CSS
// string for a name that CSS also knows is the name itself.
const NAMED_EASE_POINTS = {
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  circIn: [0, 0.55, 0.45, 1],
  circOut: [0.55, 0, 1, 0.45],
  backIn: [0.31, 0.01, 0.66, -0.59],
  backOut: [0.33, 1.53, 0.69, 0.99],
  anticipate: [0.36, 0, 0.66, -0.56]
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type NamedEase = keyof typeof NAMED_EASE_POINTS;

export const namedEasePoints = (name: string): [number, number, number, number] | null => {
  const points = (NAMED_EASE_POINTS as Record<string, readonly number[]>)[name];
  return points ? ([...points] as [number, number, number, number]) : null;
};

// The three motion names CSS has a keyword for. Emitting the keyword rather
// than its control points keeps the compiled stylesheet reading the way an
// author wrote it, and keeps `easeInOut` compiling to exactly what it always
// did.
const CSS_KEYWORD_FOR: Record<string, string> = {
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out"
};

export const cssKeywordFor = (name: string): string | null => CSS_KEYWORD_FOR[name] ?? null;

// What CSS itself accepts as an <easing-function>. `linear` and `ease` are here
// as well as in the table above: a keyword CSS knows is passed through rather
// than re-spelled as its own control points.
//
// A tuple rather than a Set, because the TYPE an author is offered is derived
// from it (see `AuthoredEasingName`). One list, and no way for the values a
// consumer can write to drift from the values this file understands.
const CSS_EASING_KEYWORD_LIST = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "step-start",
  "step-end"
] as const;

export type CssEasingKeyword = (typeof CSS_EASING_KEYWORD_LIST)[number];

/** Every name flemo answers for, for the type and for the test that pins it. */
export const AUTHORED_EASING_NAMES = [
  ...CSS_EASING_KEYWORD_LIST,
  ...(Object.keys(NAMED_EASE_POINTS) as NamedEase[])
] as const;

/**
 * The functional forms, as a type. A template literal rather than `string` so
 * the shape is offered rather than merely permitted: an author (or an agent
 * completing against this) sees that `linear(...)` is a thing flemo takes,
 * which is the half of the silent-fallback bug that a runtime warning cannot
 * reach. It does not validate the arguments; nothing here does (see below).
 */
export type CssEasingFunction =
  `cubic-bezier(${string})` | `steps(${string})` | `linear(${string})`;

/** Named eases and CSS keywords together: everything spelled as one word. */
export type AuthoredEasingName = NamedEase | CssEasingKeyword;

const CSS_EASING_KEYWORDS = new Set<string>(CSS_EASING_KEYWORD_LIST);

// The functional forms. Their ARGUMENTS are not validated: a browser drops an
// invalid timing function and falls back to `ease` on its own, which is the
// same place a stricter check here would land, and validating `linear()`'s
// grammar inside a keyframes compiler is a parser this library should not own.
const CSS_EASING_FUNCTION = /^(?:cubic-bezier|steps|linear)\(/;

const CUBIC_BEZIER_ARGS = /^cubic-bezier\(([^)]*)\)$/;

/** Whether a string is something CSS will accept verbatim. */
export const isCssEasing = (value: string): boolean =>
  CSS_EASING_KEYWORDS.has(value) || CSS_EASING_FUNCTION.test(value);

/**
 * The control points behind `cubic-bezier(a, b, c, d)`, so the sampler reads
 * the same curve the compiler emits. `steps()` and `linear()` have no handles
 * and answer null, which is what `linear` has always answered.
 */
export const cssEasingPoints = (value: string): [number, number, number, number] | null => {
  const match = CUBIC_BEZIER_ARGS.exec(value);
  if (!match) return null;
  const parts = match[1]!.split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts as [number, number, number, number];
};

/** A single trimmed string, or null for the array and undefined forms. */
export const easeName = (ease: AnimationOptions["ease"] | undefined): string | null =>
  typeof ease === "string" ? ease.trim() : null;
