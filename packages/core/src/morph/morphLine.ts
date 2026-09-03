// A LINE THAT DOES NOT BREAK ON THE WAY.
//
// A flight animates the element's box, and the element in flight is the
// ARRIVAL's tree. So the words are laid out at every width between the two ends
// under the ARRIVAL's line-breaking rules — which are not the departure's, and
// which nothing chose for the widths in between.
//
// Where both ends are one line that is always wrong. The departure's label fits
// its cell because the cell truncates it; the arrival's heading fits its page
// because the page is wide. In between, a heading's rules at a cell's width is
// a second line, and it appears on the first frame of the tap and is gone four
// frames later. Reported on iOS Safari from the playground's poster grid: the
// meta line broke after the middle dot at the small end of every push, while
// the cells beside it kept their ellipsis. It does not reproduce where the
// string happens to fit the cell, which is why headless engines with a
// substituted font show nothing.
//
// The hold is the departure's own appearance, not a new one: one line, clipped
// to the box, ellipsised where it does not fit. At the wide end the text fits
// and all three are indistinguishable from the arrival's own rules, so the
// landing that drops them changes nothing on glass.
//
// It applies only where both ends are a single line of text (see
// `MorphSnapshot.singleLine`), because clipping anything else would hide
// content the flight is supposed to be carrying.

import type { AnimationOptions } from "@transition/cssTypes";
import { invertEasing } from "@transition/cubicBezier";

import { faceGrids, faceParts, faceRatios, faceSteps, type FaceParts } from "@morph/morphFace";

/** The properties the hold writes, so a caller can reason about what it costs. */
export const LINE_HOLD = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
} as const;

/**
 * Hold the flying element to one line for the duration of a flight.
 *
 * Written as inline style, which is what the landing restores wholesale — the
 * hold needs no undo of its own.
 */
export const holdOneLine = (element: HTMLElement): void => {
  element.style.whiteSpace = LINE_HOLD.whiteSpace;
  element.style.overflow = LINE_HOLD.overflow;
  element.style.textOverflow = LINE_HOLD.textOverflow;
};

/** Whether a flight between these two ends should hold a single line. */
export const holdsOneLine = (from: boolean, to: boolean): boolean => from && to;

// WHERE A LINE SITS IN ITS BOX, AND WHY AN INTERPOLATION MOVES IT.
//
// The glyphs sit a HALF-LEADING below the top of their line box, and the
// half-leading is `(line-height - the face's own height) / 2` — which both
// engines render FLOORED to whole pixels. So the leading does not render
// continuously: it renders in steps, and a flight that interpolates it steps
// once for every pixel boundary it crosses.
//
// Mid-flight that is invisible, because everything else is moving. At the END
// it is not, and a pair whose arrival half-leading lands exactly ON a boundary
// steps there every time: an interpolation approaches its endpoint and only
// holds it from the instant the flight ends, which is the instant the flight
// lands — so the arrival's own value is never painted. Every frame renders one
// floor down and the landing puts it back. Device-measured on an iPhone, on the
// playground's meta line: 14px type in a 20px line box is a half-leading of
// exactly 1.0, the flight rendered 0, and the glyphs dropped a pixel the moment
// the flight was taken off. The heading beside it — 24px in 32px, a half-leading
// of 1.5 — never moved, on the same flight.
//
// The two ends' half-leadings are usually a hair apart (1.0 and 1.0 here); only
// the boundary separates them. So the fix is not to change what the flight
// interpolates but WHERE, by adding the same leading to both ends: enough to
// sit the whole travel in the middle of one pixel of half-leading, which then
// renders as one steady value for the flight AND at rest. The line box grows by
// that much and the glyphs by none of it — the floor absorbs it.
// WHAT "A PIXEL" IS, MEASURED RATHER THAN ASSUMED.
//
// The engines do not agree on the grid they put a line on. iOS Safari floors
// the half-leading to whole CSS pixels; desktop Chrome floors it to DEVICE
// pixels — device-reported as `lead: 1.500` on a 2x display, which no
// whole-pixel rule can produce. A correction that assumes one of them is a
// correction that is wrong on the other, so both are tried and the one that
// reproduces what BOTH ends actually rendered is the one that is used.
const quanta = (): number[] => {
  /* v8 ignore next -- SSR: nothing is rendered, so nothing is on a grid. */
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const device = typeof ratio === "number" && ratio > 0 ? 1 / ratio : 1;
  return device === 1 ? [1] : [1, device];
};

const onGrid = (value: number, quantum: number): number =>
  Math.floor(value / quantum + 1e-6) * quantum;

// Measured rects carry float noise; a thousandth of a pixel is far below any
// grid either engine uses.
const SAME = 1e-3;

/**
 * Extra leading, in px, for BOTH ends of a flight so the half-leading it
 * renders never crosses a pixel boundary.
 *
 * Zero when either end cannot be measured, and zero when the travel is wider
 * than one pixel of half-leading — no offset fits it in one, and a step
 * somewhere is then the honest outcome. Mid-flight is where it belongs.
 */
export interface LeadingEnd {
  lineHeight: number | null;
  textHeight: number | null;
  /** What the engine actually rendered for this end (see MorphSnapshot). */
  leadOffset: number | null;
}

export const leadingBias = (from: LeadingEnd, to: LeadingEnd): number => {
  const half = (end: LeadingEnd): number | null =>
    end.lineHeight === null || end.textHeight === null
      ? null
      : (end.lineHeight - end.textHeight) / 2;
  const ends = [half(from), half(to)];
  if (ends[0] === null || ends[1] === null) return 0;
  if (from.leadOffset === null || to.leadOffset === null) return 0;

  // THE MEASUREMENT IS THE AUTHORITY, NOT THE ARITHMETIC.
  //
  // Everything below rests on a claim about the engine — that it puts the line
  // on a grid — and a correction built on a misread rule would move type that
  // is sitting correctly. Both ends reported where their line was actually put,
  // so the grid is the one that reproduces both, and where no candidate does
  // the whole correction stands down and the behaviour is what it is today.
  const quantum = quanta().find(
    (q) =>
      Math.abs(onGrid(ends[0]!, q) - from.leadOffset!) < SAME &&
      Math.abs(onGrid(ends[1]!, q) - to.leadOffset!) < SAME
  );
  if (quantum === undefined) return 0;

  const low = Math.min(ends[0], ends[1]);
  const high = Math.max(ends[0], ends[1]);
  // Wider than one step of the grid: no offset fits it inside one, so it steps
  // somewhere whatever we do — and mid-flight, where everything else is moving,
  // is where it belongs.
  if (high - low >= quantum) return 0;
  // The ARRIVAL's step is the one the landing renders, so that is the step the
  // whole flight has to stay inside. Applied to the leading, which is twice the
  // half-leading.
  return (to.leadOffset + quantum / 2 - (low + high) / 2) * 2;
};

export default holdOneLine;

// A LINE-HEIGHT THAT CLIMBS THE SAME STAIRS THE FACE DOES.
//
// The bias above puts the two ENDS of a flight inside one step of the grid, and
// where the face height is continuous that is the whole story. Where it is
// quantised (see morphFace) it is not: between the ends the half-leading is a
// smooth line minus a staircase, which is a sawtooth, and it crosses whatever
// grid the engine renders leading on several times per flight. Device-reported
// on desktop Chrome as a tremor with a nudge at the end.
//
// So the line-height is emitted as its own staircase instead, holding the
// half-leading at ONE value for the whole flight: the value the arrival rests
// at, which is what makes the landing exact. The departure's own leading may
// differ by up to half a pixel, and that difference lands on the first frame,
// under a ghost that is still fully opaque.
//
// Simulated against the layout's own face heights at 61 points across the
// playground's title flight: eleven steps today, none with this.

export interface LeadingEndType {
  fontSize: number | null;
  lineHeight: number | null;
  /** The face height the engine actually reported for this end. */
  textHeight: number | null;
}

export interface LeadingStop {
  /** Percent of the flight, 0 to 100. */
  at: number;
  lineHeight: number;
  /**
   * The face's ascent from this stop on.
   *
   * A held leading is only half the answer. The BASELINE sits an ascent below
   * the inline box's top, and the ascent is on the same grid the leading is, so
   * it steps just as often — device-measured at seventeen steps of half a pixel
   * across one flight of forty-nine frames, which is a jump every third frame.
   *
   * Neither term can be made smooth: both are on the grid, so their sum is too,
   * and a baseline that has nine and a half pixels of grid to climb must climb
   * it in steps. What CAN be smooth is the box under them, because a box's
   * position is not on any grid — so the flight carries the ascent's staircase
   * BACKWARDS on the box and lets the two cancel (see `lift`).
   */
  ascent: number;
}

/** How close a prediction has to be to what was measured to be believed. */
const EXACT = 1e-6;

// The stairs a pair climbs never change while the face does not, and the
// bisection that finds them is the only part of a type morph that is not
// arithmetic. Measured at about 4ms for a first flight and nothing after it.
const stopCache = new Map<string, LeadingStop[] | null>();

/**
 * The line-height stops that hold a type morph's leading still, or null.
 *
 * Null wherever the correction cannot be justified: a face whose metrics cannot
 * be read, an end that was never measured, a flight whose type does not change
 * size, and — the one that matters — a prediction that does not reproduce what
 * the engine actually reported at BOTH ends. That last is what stands in for a
 * browser check: an engine that does not quantise its face heights fails it at
 * every size, and is left alone.
 */
export const leadingStops = (
  from: LeadingEndType,
  to: LeadingEndType,
  font: { family: string; weight: string | number; style: string } | null,
  ease: AnimationOptions["ease"]
): LeadingStop[] | null => {
  if (!font) return null;
  if (from.fontSize === null || to.fontSize === null) return null;
  if (from.lineHeight === null || to.lineHeight === null) return null;
  if (from.textHeight === null || to.textHeight === null) return null;
  if (Math.abs(from.fontSize - to.fontSize) < EXACT) return null;

  const key = `${font.style}|${font.weight}|${font.family}|${from.fontSize}|${to.fontSize}|${from.lineHeight}|${to.lineHeight}|${from.textHeight}|${to.textHeight}|${JSON.stringify(ease ?? null)}`;
  const cached = stopCache.get(key);
  if (cached !== undefined) return cached;
  const built = buildStops(from as MeasuredEnd, to as MeasuredEnd, font, ease);
  stopCache.set(key, built);
  return built;
};

/** The same two ends, with everything the caller has already checked for. */
interface MeasuredEnd {
  fontSize: number;
  lineHeight: number;
  textHeight: number;
}

const buildStops = (
  from: MeasuredEnd,
  to: MeasuredEnd,
  font: { family: string; weight: string | number; style: string },
  ease: AnimationOptions["ease"]
): LeadingStop[] | null => {
  const ratios = faceRatios(font);
  if (!ratios) return null;

  // THE MEASUREMENT IS THE AUTHORITY. The engine snaps each half of the face
  // height to a grid, and which grid that is differs between displays — so the
  // candidates are tried and the one that reproduces what was actually measured
  // at BOTH ends is the one used. Where none does, the engine is not one that
  // steps at all (or not one this understands), and nothing is corrected.
  // The candidate brings its own measurements with it: the check IS the
  // measurement, so nothing is asked for twice.
  let grid: { scale: number; ends: [FaceParts, FaceParts] } | null = null;
  for (const candidate of faceGrids()) {
    const first = faceParts(from.fontSize, font, candidate);
    const last = faceParts(to.fontSize, font, candidate);
    if (first === null || last === null) continue;
    if (!matches(first, from.textHeight) || !matches(last, to.textHeight)) continue;
    grid = { scale: candidate, ends: [first, last] };
    break;
  }
  if (grid === null) return null;
  const { scale, ends } = grid;

  // The leading the arrival RESTS at, which every stop is built to preserve.
  const leading = to.lineHeight - to.textHeight;
  const invert = invertEasing(ease);
  const span = to.fontSize - from.fontSize;
  const stops: LeadingStop[] = [
    { at: 0, lineHeight: from.textHeight + leading, ascent: ends[0].ascent }
  ];
  for (const step of faceSteps(from.fontSize, to.fontSize, ratios, scale, (size) =>
    faceParts(size, font, scale)
  )) {
    // Font size interpolates with the eased progress, so the TIME a step is met
    // is the time at which the ease has travelled that far.
    const at = invert((step.size - from.fontSize) / span) * 100;
    /* v8 ignore next -- faceSteps returns only sizes strictly inside the range,
       so a stop cannot land on either end. */
    if (at <= 0 || at >= 100) continue;
    stops.push({
      at,
      lineHeight: step.parts.ascent + step.parts.descent + leading,
      ascent: step.parts.ascent
    });
  }
  // The last stop is the arrival's own line-height by construction, so the
  // landing restores exactly what the flight ended on.
  stops.push({ at: 100, lineHeight: to.lineHeight, ascent: ends[1].ascent });
  return stops.length > 2 ? stops : null;
};

const matches = (parts: FaceParts, measured: number): boolean =>
  Math.abs(parts.ascent + parts.descent - measured) < EXACT;
