import type { AuthoredEasingName, CssEasingFunction } from "@transition/easing";

import type { Properties } from "csstype";

// Local CSS-like types so @flemo/core stays independent of any animation
// library. Mirrors the subset of motion's Target / AnimationOptions that
// flemo actually compiles. The keyframes compiler accepts these shapes for
// `transition.initial`, variant `value`, and the imperative inline animator.

/**
 * WHAT AN EASE MAY BE, offered rather than merely permitted.
 *
 * This was `string`, and every string typechecked while only nine motion-style
 * names were understood — so `ease-out`, `cubic-bezier(...)`, `steps(...)` and
 * the `linear(...)` a spring ships as all compiled to `ease` with nothing said.
 * The compiler accepts them now, and the union is what lets an author (or a
 * tool completing against it) SEE that, which is the half of that bug a runtime
 * warning arrives too late for.
 *
 * `(string & {})` keeps every existing call site compiling and keeps a computed
 * easing possible, at the cost of letting a typo through — the same trade every
 * name-like surface in this library already makes (`TransitionName`,
 * `PartTransitionName`, `MorphTransitionName`). What the union does not catch,
 * `warnUnknownEasing` says out loud in development.
 */
export type AnimationEasing =
  | AuthoredEasingName
  | CssEasingFunction
  | (string & {})
  | readonly [number, number, number, number]
  | [number, number, number, number];

export interface AnimationOptions {
  duration?: number;
  ease?: AnimationEasing;
  delay?: number;
}

// Compiler-friendly CSS property shape with full IDE autocomplete across
// the entire transitionable CSS surface (filter, color, boxShadow, etc.),
// via `csstype`, the same types-only package React uses for its `style`
// prop. Keys are camelCase as in inline React styles; the compiler kebabs
// them on the way to the keyframe.
//
// On top of csstype's `Properties`, flemo adds short transform aliases.
// Authors can write `{ x: 16 }` instead of `{ transform: "translateX(16px)" }`.
// The compiler joins all transform-bucket entries into a single `transform`
// declaration (see `targetToDecls` in `compileTransitionStyles.ts`).
//
// CSS custom properties (`--var`) are kept open for callers who animate
// them via the registered-property API. Everything else is constrained to
// the CSS property vocabulary so typos surface at compile time.
// csstype declares CSS's individual `rotate`/`scale`/`translate` properties
// with their own restricted unions. flemo overloads the bare `rotate` /
// `scale*` keys as transform-shortcut shorthands, so we omit csstype's
// versions before extending. The shortcut wins in our interface.
type CssProperties = Omit<
  Properties<string | number, string | number>,
  "rotate" | "scale" | "translate"
>;

export interface TransitionTarget extends CssProperties {
  // Transform shortcuts (numbers → px for translate, deg for rotate, scalar
  // for scale/opacity). String values pass through verbatim ("100%", "1rem").
  x?: string | number;
  y?: string | number;
  z?: string | number;
  scale?: string | number;
  scaleX?: string | number;
  scaleY?: string | number;
  rotate?: string | number;
  rotateX?: string | number;
  rotateY?: string | number;
  rotateZ?: string | number;

  // Author-defined CSS custom properties remain an open escape hatch, useful
  // for theme tokens or registered properties (`@property --foo`) animated
  // via keyframes. `[key: \`--${string}\`]` would be stricter but a few
  // TypeScript versions still struggle with template-literal index keys, so
  // we keep the broad index signature scoped to the `--` prefix here.
  [key: `--${string}`]: string | number | undefined;
}

// `initial` historically allowed transition options too (Motion's
// TargetAndTransition). The compiler only inspects the target half. Option
// fields on `initial` are ignored.
export type InitialTarget = TransitionTarget;
