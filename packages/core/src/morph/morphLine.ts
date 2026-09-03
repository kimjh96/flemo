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
