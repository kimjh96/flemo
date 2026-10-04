import { cupertino, layout, material, none } from "@flemo/core";

// What the readout knows about a transition: the clock and the curve of the
// ACTIVE screen's push and pop, read from the definition itself so the readout
// can never disagree with what runs.
export interface TransitionSpec {
  push: { duration: number; ease: [number, number, number, number] };
  pop: { duration: number; ease: [number, number, number, number] };
}

type Ease = [number, number, number, number];

type VariantLike = { options?: { duration?: number; ease?: unknown } };
type DefinitionLike = { variants: Record<string, VariantLike> };

const NAMED: Record<string, Ease> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1]
};

const toEase = (value: unknown): Ease => {
  if (Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number")) {
    return value as Ease;
  }
  if (typeof value === "string" && NAMED[value]) return NAMED[value]!;
  return NAMED.ease!;
};

export function specOf(definition: DefinitionLike): TransitionSpec {
  const read = (key: string) => {
    const options = definition.variants[key]?.options ?? {};
    return { duration: options.duration ?? 0, ease: toEase(options.ease) };
  };
  return { push: read("PUSHING-true"), pop: read("POPPING-true") };
}

const BUILT_IN: Record<string, DefinitionLike> = { cupertino, material, layout, none };

export function builtInSpec(name: string): TransitionSpec | null {
  const definition = BUILT_IN[name];
  return definition ? specOf(definition) : null;
}

// An SVG path for a cubic-bezier easing, drawn in a w×h box with time on x and
// progress on y (up).
export function curvePath([x1, y1, x2, y2]: Ease, w: number, h: number): string {
  return `M0 ${h} C ${x1 * w} ${h - y1 * h}, ${x2 * w} ${h - y2 * h}, ${w} 0`;
}
