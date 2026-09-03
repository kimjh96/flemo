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
import { invertEasing, resolveEasing } from "@transition/cubicBezier";

import {
  faceAims,
  faceGrids,
  faceParts,
  faceRatios,
  runAdvance,
  sameFace,
  type FaceParts
} from "@morph/morphFace";

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

/**
 * How near a step has to be pinned, as a fraction of the flight.
 *
 * A thousandth of a flight is under a millisecond of a half-second one, which
 * is a fifteenth of a frame: far too small for a frame to land inside the gap
 * between where the box thinks the ascent stepped and where it did.
 */
const TIME = 0.001;

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
  const curve = resolveEasing(ease);
  const span = to.fontSize - from.fontSize;
  // A STEP IS PINNED IN TIME, NOT IN SIZE.
  //
  // The arithmetic aims at a size, and a size is the wrong thing to be exact
  // about: an ease that lands slowly maps a thousandth of a pixel of font size
  // to several milliseconds near the end, which is a whole frame in which the
  // box has moved and the ascent has not. Device-reported as two half-pixel
  // jumps on a card whose type grew 13px to 24px. So the aim is turned into a
  // time and the search happens there, where the precision means what it has to.
  const face = (progress: number): FaceParts | null =>
    faceParts(from.fontSize + span * curve(progress), font, scale);
  const stops: LeadingStop[] = [
    { at: 0, lineHeight: from.textHeight + leading, ascent: ends[0].ascent }
  ];
  // Each aim is searched between its NEIGHBOURS, never in a window of its own
  // size. An ease that opens fast packs several steps into a hundredth of the
  // flight, and a fixed window there swallows the ones after the first: three
  // half-pixel jumps came back the moment one was tried.
  const aims = faceAims(from.fontSize, to.fontSize, ratios, scale).map((aim) =>
    invert((aim - from.fontSize) / span)
  );
  let floor = 0;
  for (let i = 0; i < aims.length; i += 1) {
    const here = aims[i]!;
    const before = i > 0 ? (aims[i - 1]! + here) / 2 : 0;
    const after = i < aims.length - 1 ? (here + aims[i + 1]!) / 2 : 1;
    const at = settle(Math.max(floor, before), after, face);
    if (at === null) continue;
    const parts = face(at);
    /* v8 ignore next -- `settle` only returns a time it measured. */
    if (parts === null) continue;
    floor = at;
    // A stop landing on either end is harmless: the endpoint pushed after this
    // loop is written later and is the one the flight ends on.
    stops.push({
      at: at * 100,
      lineHeight: parts.ascent + parts.descent + leading,
      ascent: parts.ascent
    });
  }
  // The last stop is the arrival's own line-height by construction, so the
  // landing restores exactly what the flight ended on.
  stops.push({ at: 100, lineHeight: to.lineHeight, ascent: ends[1].ascent });
  return stops.length > 2 ? stops : null;
};

const matches = (parts: FaceParts, measured: number): boolean =>
  Math.abs(parts.ascent + parts.descent - measured) < EXACT;

/** The time at which the face first changes inside `[lo, hi]`, or null. */
const settle = (
  lo: number,
  hi: number,
  face: (progress: number) => FaceParts | null
): number | null => {
  let low = Math.max(0, lo);
  // Clamped rather than guarded: a bracket that has already been passed
  // collapses to a point, and a point cannot differ from itself.
  let high = Math.max(low, Math.min(1, hi));
  const before = face(low);
  const after = face(high);
  if (before === null || after === null || sameFace(before, after)) return null;
  while (high - low > TIME) {
    const mid = (low + high) / 2;
    const here = face(mid);
    /* v8 ignore next -- the guard above already refused a face with no metrics. */
    if (here === null) return null;
    if (sameFace(here, before)) low = mid;
    else high = mid;
  }
  return high;
};

// A RUN THAT DOES NOT DRIFT APART.
//
// The leading and the ascent are one number each, so one channel cancels them.
// The glyph advances looked like nine numbers and therefore hopeless — and that
// was wrong. A run's width against its size is ONE curve, and where that curve
// is not the straight line between its ends, every glyph after the first sits
// off by the part of the error that accumulated before it. An error that
// accumulates evenly across a run is cancelled by spreading its negative over
// the gaps, which is exactly what `letter-spacing` is.
//
// Whether there is anything to cancel is the FACE's business, not the flight's.
// Sweeping a nine-character title from 14px to 24px and fitting its width
// against its size: Helvetica, Arial, Georgia, Times, Courier, Impact, Comic
// Sans and Pretendard Variable all sit on the line to within 0.008px, and for
// them this whole machine measures zero and emits a correction of about
// 0.003px, which is nothing. `system-ui` and `-apple-system` deviate by 0.95px,
// in BOTH engines — an optically sized face resolving a different outline as it
// grows. That stack is the default of every app that does not ship a webfont,
// so the case is common even though most named families do not show it.
//
// The target is not the width the engine would lay out — that width is what
// carries the error. It is the width the run would have if advances tracked
// their size: the straight line between the two ends, which is what the size
// itself is travelling along.
//
// Two things decide how much of the error actually comes off. The error is a
// smooth curve rather than a staircase (401 distinct widths across a 10px
// sweep, no findable edges), so the correction is INTERPOLATED between its
// stops instead of held — a hold leaves each step's whole height on the glass,
// a ramp leaves only the curvature inside it. And the stops are placed evenly
// in SIZE rather than in time, since the error lives in size and an eased
// flight crosses most of its size in the first few frames. Sixteen stops:
// held and time-even the worst frame kept 0.44px of the 0.95px, ramped and
// size-even it keeps 0.12px, at the same bytes.
//
// The price is the tracking moving by the correction spread over the gaps,
// which is smaller than the error it removes and moves the run TOWARDS the
// width it should have rather than away from it.

export interface TrackStop {
  /** Percent of the flight, 0 to 100. */
  at: number;
  /** The correction, in px, to add to every gap between the glyphs. */
  fix: number;
}

/**
 * How many places the correction is sampled at.
 *
 * It is not a staircase with findable edges the way a face height is, so there
 * is nothing to aim at and the curve is simply sampled. Sixteen stops, ramped
 * and spaced evenly in size, hold the worst frame to about an eighth of a pixel
 * on the worst face measured; doubling them buys another 0.04px for twice the
 * bytes, which is not worth carrying in every sheet.
 */
const TRACK_SAMPLES = 16;

/**
 * How far a run has to be off the line before correcting it is worth anything.
 *
 * A CORRECTION SMALLER THAN THE GRID IT RIDES ON IS A NEW DEFECT. Tracking
 * reaches the glass through layout, and layout carries a run's width on a
 * 1/64px grid: measured, 0.0001px per gap over eighteen gaps rounds away to
 * nothing and 0.005px per gap lands on exactly 6/64. A correction that ramps
 * through values below that grid cannot track the curve it was built from. All
 * it can do is cross grid lines, which is a staircase where there was none.
 *
 * That is not hypothetical. The poster grid's meta line is 0.03px off the line
 * across its whole flight, and correcting it moved that line from ZERO
 * discontinuities to seven, because every grid crossing the ramp made was a
 * step the run had not been taking. The canvas model is only good to 0.015px
 * against layout anyway, so below this floor the correction is fitting noise.
 *
 * Half a pixel is the scale the eye was reported at throughout this work, and
 * it separates the two populations cleanly: every face that tracks its size
 * measures under 0.01px, a small line's own bow measures 0.03px, and
 * `system-ui` at a title's travel measures 0.95px.
 */
const TRACK_FLOOR = 0.5;

/** The tracking correction for a growing run, or null where there is none to make. */
export const trackStops = (
  text: string,
  from: { fontSize: number | null },
  to: { fontSize: number | null },
  font: { family: string; weight: string | number; style: string } | null,
  ease: AnimationOptions["ease"]
): TrackStop[] | null => {
  if (!font) return null;
  if (from.fontSize === null || to.fontSize === null) return null;
  if (Math.abs(from.fontSize - to.fontSize) < EXACT) return null;
  // One glyph has no gap to spread a correction over, and nothing accumulates
  // across a run of one.
  const gaps = [...text].length - 1;
  if (gaps < 1) return null;

  const key = `${font.style}|${font.weight}|${font.family}|${from.fontSize}|${to.fontSize}|${text}|${JSON.stringify(ease ?? null)}`;
  const cached = trackCache.get(key);
  if (cached !== undefined) return cached;
  const built = buildTrack(text, from.fontSize, to.fontSize, gaps, font, ease);
  trackCache.set(key, built);
  return built;
};

const trackCache = new Map<string, TrackStop[] | null>();

const buildTrack = (
  text: string,
  from: number,
  to: number,
  gaps: number,
  font: { family: string; weight: string | number; style: string },
  ease: AnimationOptions["ease"]
): TrackStop[] | null => {
  const ends = [runAdvance(text, from, font), runAdvance(text, to, font)];
  if (ends[0] === null || ends[1] === null) return null;
  const invert = invertEasing(ease);
  const span = to - from;
  const stops: TrackStop[] = [];
  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    // Even in size, then asked back what time the flight is at that size.
    const part = i / TRACK_SAMPLES;
    const size = from + span * part;
    const measured = runAdvance(text, size, font);
    /* v8 ignore next -- the ends above already refused a face with no metrics. */
    if (measured === null) return null;
    // The width a run whose advances tracked their size would have here: the
    // straight line between the two ends, which is what the size travels along.
    const ideal = ends[0] + (ends[1] - ends[0]) * part;
    stops.push({ at: invert(part) * 100, fix: (ideal - measured) / gaps });
  }
  // Below the floor there is nothing this can deliver, and trying puts its own
  // staircase on a run that was travelling smoothly.
  const worst = Math.max(...stops.map((stop) => Math.abs(stop.fix))) * gaps;
  if (worst < TRACK_FLOOR) return null;
  // Both ends measure themselves, so the correction is zero there by
  // construction and the landing is untouched.
  return stops;
};
