import type { AnimationOptions } from "@transition/cssTypes";

export type EasingFunction = (progress: number) => number;

// Solve a CSS cubic-bezier timing function: given x (time progress), return y
// (value progress). Binary search on the x polynomial — the curve is
// monotonic in x for valid CSS control points (x1, x2 ∈ [0, 1]), and 40
// iterations resolve x to ~1e-12, far below a device pixel.
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number): EasingFunction => {
  const sampleX = (u: number) => 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3;
  const sampleY = (u: number) => 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;

  return (progress: number) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (sampleX(mid) < progress) low = mid;
      else high = mid;
    }
    return sampleY((low + high) / 2);
  };
};

/**
 * The INVERSE of a CSS timing function: given the value progress you want to
 * see, the time progress that produces it.
 *
 * A scrubbed animation needs this. Setting an animation's clock to the drag's
 * fraction moves the CLOCK linearly, and what the eye follows is the curve's
 * output — with an ease that opens slowly, a finger a tenth of the way across
 * moves the element a fiftieth, and everything it did not do is left for the
 * release to rush through. Inverting the curve makes the element track the
 * finger and leaves the release only what is really left.
 *
 * Binary search on y, the same shape as `cubicBezier`'s search on x. An
 * overshooting curve (`backOut`, `anticipate`) is not monotonic in y, so the
 * search returns the first crossing — which is the one before the overshoot,
 * and the only one a drag can mean.
 */
export const invertEasing = (ease: AnimationOptions["ease"] | undefined): EasingFunction => {
  const points = easeControlPoints(ease);
  if (!points) return (value) => value;
  const [x1, y1, x2, y2] = points;
  const sampleX = (u: number) => 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3;
  const sampleY = (u: number) => 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;
  return (value: number) => {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (sampleY(mid) < value) low = mid;
      else high = mid;
    }
    return sampleX((low + high) / 2);
  };
};

const LINEAR: EasingFunction = (progress) => progress;

// Named-ease control points, mirroring `easingToCss` in the keyframes
// compiler exactly so the rAF player and the CSS driver produce the same
// curve for the same transition definition.
const NAMED_EASES: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  circIn: [0, 0.55, 0.45, 1],
  circOut: [0.55, 0, 1, 0.45],
  backIn: [0.31, 0.01, 0.66, -0.59],
  backOut: [0.33, 1.53, 0.69, 0.99],
  anticipate: [0.36, 0, 0.66, -0.56]
};

/**
 * The control points behind an authored ease, named or spelled out — `null`
 * for `linear`, which has no handles to work with.
 *
 * Exported for the swipe release, which re-aims an authored curve's opening
 * slope onto the gesture that produced it (see swipeSettle.ts).
 */
export const easeControlPoints = (
  ease: AnimationOptions["ease"] | undefined
): [number, number, number, number] | null => {
  if (Array.isArray(ease)) {
    if (ease.length === 4 && ease.every((n) => typeof n === "number")) {
      return [...(ease as [number, number, number, number])];
    }
    return null;
  }
  if (typeof ease === "string") {
    if (ease === "linear") return null;
    return [...(NAMED_EASES[ease] ?? NAMED_EASES.ease!)];
  }
  return [...NAMED_EASES.ease!];
};

export const resolveEasing = (ease: AnimationOptions["ease"] | undefined): EasingFunction => {
  if (Array.isArray(ease)) {
    if (ease.length === 4 && ease.every((n) => typeof n === "number")) {
      const [x1, y1, x2, y2] = ease as [number, number, number, number];
      return cubicBezier(x1, y1, x2, y2);
    }
    return LINEAR;
  }
  if (typeof ease === "string") {
    if (ease === "linear") return LINEAR;
    const points = NAMED_EASES[ease] ?? NAMED_EASES.ease!;
    return cubicBezier(...points);
  }
  return cubicBezier(...NAMED_EASES.ease!);
};
