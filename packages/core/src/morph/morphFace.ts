// WHERE A FACE'S OWN HEIGHT COMES FROM, AND WHY IT IS NOT A LINE.
//
// A type morph grows by re-typesetting: the font size interpolates and the
// words lay themselves out at every size on the way. Where the GLYPHS sit
// inside the box while that happens is the half-leading, which is
// `(line-height - the face's own height) / 2`. The line-height is ours and
// interpolates smoothly. The face height is the engine's, and on Blink it does
// not: it is quantised, so it climbs in whole-pixel steps.
//
// A smooth line minus a staircase is a sawtooth. Device-reported on desktop
// Chrome, on the playground's title: the rendered half-leading ran
// 2 -> 1.5 -> 1 -> 1.5 across one flight, three steps of half a pixel each. The
// last of them lands in the ease's long tail, which is why it reads as the type
// settling and then being nudged down a moment later, and the earlier ones read
// as a tremor. They are one defect seen twice.
//
// The cure is to make the line-height climb the same staircase, so the
// half-leading is a constant and there is no boundary left to cross. That needs
// the face height at every size the flight passes through, and measuring those
// is exactly what cannot be afforded: a layout probe per size costs 14ms for
// forty of them on the frame a flight starts.
//
// It does not have to be measured with LAYOUT. A canvas reports the same
// font's metrics with none, and Blink's are the very ones the line box is built
// from: bisected against the layout's own height, every step boundary in a
// flight's range agreed to the last digit. So the canvas is the oracle, and the
// only question is how few times it has to be asked.
//
// WHAT A STEP IS WORTH is not the same everywhere. The engine snaps each half
// of the height to its own grid, and that grid is a whole CSS pixel on one
// display and a DEVICE pixel on another: device-reported from a 2x desktop
// Chrome, a 14.5px face measuring 17.5 where a headless 2x reported whole
// numbers throughout. A canvas rounds to ITS pixels, so asking it at a size
// scaled by the grid and dividing the answer back is the same quantisation the
// layout used. Which scale that is comes from the same discipline as everything
// else here: try the candidates, keep the one that reproduces both measured
// ends, and correct nothing where neither does.
//
// Two ratios off one call at a large size place each boundary to about a
// hundredth of a pixel of font size, which is close enough to be wrong: at the
// end of a flight the ease crawls, and a hundredth of font size was measured to
// be a whole frame wide there. So the ratios are used to AIM, and a short
// bisection on the canvas lands each boundary exactly. Six or so calls a
// boundary, once per face and size pair, inside the hold that a flight's setup
// already runs in.
//
// WebKit's line box does not round at all, and there the prediction misses at
// every size (0 of 41) -- which is the check standing in for a browser sniff.
// A face whose prediction cannot reproduce what was actually measured at both
// ends of the flight gets no correction, and the behaviour is what it is today.

/** The two ratios a face's height is built from, per em. */
export interface FaceRatios {
  ascent: number;
  descent: number;
}

// One call per face, and the size it is taken at is what makes it exact: the
// metrics come back ROUNDED, so the ratio is only as precise as the size it was
// divided by. At 1000px they are good to a two-thousandth of an em, which puts
// a step boundary within about a hundredth of a pixel of font size — and that
// was measured to be a whole frame wide at the end of a flight, where the ease
// crawls. At 10000px the boundary lands inside a tenth of a frame.
//
// Not higher: engines clamp the font size, and a clamped probe divided by the
// size that was asked for is a ratio ten times too small. The plausibility check
// below is what catches that rather than a version test.
const PROBE_SIZE = 10000;

// Every real face's ascent plus descent is near one em. A ratio far outside
// that band is not this font's metrics — it is a clamped probe, or a host
// answering with the drawn glyphs' box instead of the font's.
const PLAUSIBLE = { low: 0.6, high: 2.5 };

const ratioCache = new Map<string, FaceRatios | null>();

// A fallback face and the webfont that replaces it are different metrics under
// one declaration, so the loader's state is part of what a cached answer is
// about — the same reason the type metrics in morphGeometry key on it.
/* v8 ignore next 3 -- SSR, and a host with no font loader. */
const loaderState = (): string =>
  typeof document === "undefined" ? "" : (document.fonts?.status ?? "");

/**
 * The face's ascent and descent per em, or null where they cannot be had.
 *
 * Keyed on the font shorthand, so every element wearing the same type shares
 * one answer for the session.
 */
export const faceRatios = (font: {
  family: string;
  weight: string | number;
  style: string;
}): FaceRatios | null => {
  const key = `${font.style}|${font.weight}|${font.family}|${loaderState()}`;
  const seen = ratioCache.get(key);
  if (seen !== undefined) return seen;

  const measured = measureRatios(key, font);
  ratioCache.set(key, measured);
  return measured;
};

// One canvas for the session. Setting `font` is what a measurement costs, and
// allocating an element per call would add to that; asking it for its context
// each time costs nothing, since a canvas hands back the same one.
let element: HTMLCanvasElement | null | undefined;
const canvas = (): CanvasRenderingContext2D | null => {
  if (element === undefined) {
    /* v8 ignore next 3 -- SSR, and a host with no canvas: neither has a line
       box to correct in the first place. */
    element =
      typeof document === "undefined" || typeof document.createElement !== "function"
        ? null
        : document.createElement("canvas");
  }
  /* v8 ignore next -- the null is the host guard above, already covered where
     it is set. */
  return element ? element.getContext("2d") : null;
};

const measureRatios = (
  key: string,
  font: { family: string; weight: string | number; style: string }
): FaceRatios | null => {
  const context = canvas();
  if (!context) return null;
  try {
    context.font = `${font.style} ${font.weight} ${PROBE_SIZE}px ${font.family}`;
    const metrics = context.measureText("");
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    // A host that does not report the font's own box (rather than the drawn
    // text's) has nothing to derive from.
    if (typeof ascent !== "number" || typeof descent !== "number") return null;
    if (!(ascent > 0) || !(descent >= 0)) return null;
    const ratios = { ascent: ascent / PROBE_SIZE, descent: descent / PROBE_SIZE };
    const em = ratios.ascent + ratios.descent;
    if (em < PLAUSIBLE.low || em > PLAUSIBLE.high) return null;
    return ratios;
    /* v8 ignore next 4 -- a malformed font shorthand throws on assignment; the
       guard keeps a flight from failing on a face it simply cannot correct. */
  } catch {
    ratioCache.set(key, null);
    return null;
  }
};

/** The grids an engine is known to snap the two halves of a face height to. */
export const faceGrids = (): number[] => {
  /* v8 ignore next -- SSR: nothing is rendered, so nothing is on a grid. */
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return typeof ratio === "number" && ratio > 1 ? [1, ratio] : [1];
};

const snap = (value: number, scale: number) => Math.round(value * scale) / scale;

/**
 * The face height the line box will be built from, at one size.
 *
 * `scale` is the reciprocal of the grid: 1 for whole pixels, the device pixel
 * ratio for device pixels.
 */
export const faceHeightAt = (size: number, ratios: FaceRatios, scale: number): number =>
  snap(size * ratios.ascent, scale) + snap(size * ratios.descent, scale);

/** The two halves of a face's box at one size, as the font reports them. */
export interface FaceParts {
  ascent: number;
  descent: number;
}

/**
 * The face's ascent and descent at one size, as the font reports them.
 *
 * The same numbers the line box is built from, got without laying anything out.
 * The BASELINE sits at the ascent below the inline box's top, so a flight that
 * holds its half-leading still is only half done: the ascent is on the same
 * grid and steps just as often (see morphLine).
 */
export const faceParts = (
  size: number,
  font: { family: string; weight: string | number; style: string },
  scale: number
): FaceParts | null => {
  const context = canvas();
  if (!context) return null;
  try {
    // The canvas rounds to ITS pixels. Asking at a scaled size and dividing the
    // answer back is what puts the answer on the grid the layout used.
    context.font = `${font.style} ${font.weight} ${size * scale}px ${font.family}`;
    const metrics = context.measureText("");
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    if (typeof ascent !== "number" || typeof descent !== "number") return null;
    return { ascent: ascent / scale, descent: descent / scale };
    /* v8 ignore next 3 -- a malformed shorthand throws on assignment. */
  } catch {
    return null;
  }
};

/** The face's own height at one size: its two halves added up. */
export const faceHeight = (
  size: number,
  font: { family: string; weight: string | number; style: string },
  scale: number
): number | null => {
  const parts = faceParts(size, font, scale);
  return parts === null ? null : parts.ascent + parts.descent;
};

/** How near a boundary has to be pinned: a thousandth of a pixel of font size. */
const PRECISION = 0.001;
/** How far either side of an aimed boundary the real one can be. */
const BRACKET = 0.05;

/**
 * Every size in `[from, to]` at which the face height changes, with the height
 * it takes from there on.
 *
 * The arithmetic aims and the canvas decides. Each half of the height steps
 * where `size * ratio` crosses a half, which gives a candidate; the candidate is
 * then bracketed and bisected against what the font actually reports, because a
 * candidate off by a hundredth is a whole frame wrong where the ease is slow.
 */
export const faceSteps = (
  from: number,
  to: number,
  ratios: FaceRatios,
  scale: number,
  measure: (size: number) => FaceParts | null
): { size: number; parts: FaceParts }[] => {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const aimed: number[] = [];
  for (const ratio of [ratios.ascent, ratios.descent]) {
    if (!(ratio > 0)) continue;
    // Halfway between two points of the grid is where a half of the height
    // snaps to the next one.
    const step = ratio * scale;
    /* v8 ignore next -- a grid with no size to it enumerates nothing. */
    if (!(step > 0)) continue;
    let k = Math.ceil(low * step - 0.5);
    // Counted rather than measured by what was kept: a candidate outside the
    // range pushes nothing, and a backstop that only watched the result would
    // not be watching at all.
    for (let seen = 0; seen < 4096; seen += 1) {
      const size = (k + 0.5) / step;
      if (size > high) break;
      if (size > low) aimed.push(size);
      k += 1;
    }
  }
  aimed.sort((a, b) => a - b);

  const found: { size: number; parts: FaceParts }[] = [];
  for (const aim of aimed) {
    const edge = bisect(Math.max(low, aim - BRACKET), Math.min(high, aim + BRACKET), measure);
    if (edge === null) continue;
    // Two aims can land on one real boundary when both halves step together.
    if (found.length > 0 && Math.abs(found[found.length - 1]!.size - edge.size) < PRECISION)
      continue;
    found.push(edge);
  }
  return from <= to ? found : found.reverse();
};

/** The size at which `measure` first changes inside `[lo, hi]`, or null. */
const bisect = (
  lo: number,
  hi: number,
  measure: (size: number) => FaceParts | null
): { size: number; parts: FaceParts } | null => {
  const below = measure(lo);
  const above = measure(hi);
  if (below === null || above === null || same(below, above)) return null;
  let low = lo;
  let high = hi;
  while (high - low > PRECISION) {
    const mid = (low + high) / 2;
    const here = measure(mid);
    /* v8 ignore next -- the guard above already refused a face with no metrics. */
    if (here === null) return null;
    if (same(here, below)) low = mid;
    else high = mid;
  }
  return { size: high, parts: above };
};

const same = (a: FaceParts, b: FaceParts): boolean =>
  a.ascent === b.ascent && a.descent === b.descent;
