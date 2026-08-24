import { capturePaint } from "@morph/morphPaint";
import { IDENTITY_POSE, type MorphPose, type PosePoint } from "@morph/morphPose";

export interface MorphRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// What a morph element looks like at the instant a flight starts: where it sits
// and the corner it holds. Captured for BOTH sides — the arriving element reads
// its partner's snapshot to know where to come from.
export interface MorphSnapshot {
  rect: MorphRect;
  /** The computed `font-size` in px — what makes type grow instead of stretch. */
  fontSize: number | null;
  /**
   * The computed `font-weight`, and the computed `letter-spacing` in px.
   *
   * Size is only one of type's dimensions. A list label at 14px/600 handing
   * over to a heading at 24px/800 that interpolates size alone wears the
   * heading's WEIGHT from the first frame: the type visibly thickens in a
   * single step and then merely gets bigger, which reads as a swap wearing a
   * growth. Tracking is the same story in the other axis.
   *
   * Both are null when the two ends cannot be interpolated — `letter-spacing:
   * normal` is not a length, and an element with no resolved weight has
   * nothing to interpolate from.
   */
  fontWeight: number | null;
  letterSpacing: number | null;
  wordSpacing: number | null;
  lineHeight: number | null;
  /**
   * The computed `aspect-ratio`, or null when the element does not declare one.
   *
   * It is what lets a nested element change SHAPE on the way rather than
   * snapping to its destination's proportions on the first frame: a square
   * thumbnail becoming a 4:3 hero is a ratio interpolating, not a box being
   * replaced.
   */
  aspectRatio: string | null;
  /**
   * The element's own box model at capture: the padding it holds its contents
   * in, and the margin that holds it away from its neighbours.
   *
   * Interpolating the outer box is not enough. The element in flight is the
   * ARRIVAL's tree, so on the first frame it is already wearing the arrival's
   * spacing — a list card with `p-2` handing over to a panel with `p-3` starts
   * with its contents 8px narrower than the ones it is replacing, which is a
   * visible flinch the wrong way at the exact moment of the tap.
   */
  padding: string;
  margin: string;
  /**
   * Everything else the two ends can set differently — the corner, the surface
   * colour, the border, the shadow (see morphPaint's table). Declared as data
   * rather than as a branch per property, because that list was only ever as
   * complete as the last thing someone noticed on glass.
   */
  paint: Record<string, string>;
}

export const rectCentre = (rect: MorphRect): PosePoint => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2
});

const SINGLE_LENGTH = /^(-?[\d.]+)px$/;

// `letter-spacing: normal` is font-defined rather than a length, so it has no
// value to interpolate against a px one. Those elements keep their authored
// tracking through the flight.
const readLength = (computed: string | null | undefined): number | null => {
  if (!computed) return null;
  const match = SINGLE_LENGTH.exec(computed.trim());
  if (!match) return null;
  const value = Number.parseFloat(match[1]!);
  return Number.isFinite(value) ? value : null;
};

export const captureMorphSnapshot = (element: HTMLElement): MorphSnapshot => {
  const box = element.getBoundingClientRect();
  const styles = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
  const fontSize = styles ? Number.parseFloat(styles.fontSize) : NaN;
  const fontWeight = styles ? Number.parseFloat(styles.fontWeight) : NaN;
  const ratio = styles?.aspectRatio;
  const sides = (prefix: "padding" | "margin") =>
    styles
      ? `${styles[`${prefix}Top`]} ${styles[`${prefix}Right`]} ${styles[`${prefix}Bottom`]} ${styles[`${prefix}Left`]}`
      : "0px 0px 0px 0px";
  return {
    rect: { x: box.left, y: box.top, width: box.width, height: box.height },
    fontSize: Number.isFinite(fontSize) ? fontSize : null,
    fontWeight: Number.isFinite(fontWeight) ? fontWeight : null,
    letterSpacing: readLength(styles?.letterSpacing),
    wordSpacing: readLength(styles?.wordSpacing),
    // `line-height: normal` is font-defined rather than a length, so readLength
    // declines it and those elements keep their own leading through the flight.
    lineHeight: readLength(styles?.lineHeight),
    aspectRatio: ratio && ratio !== "auto" ? ratio : null,
    padding: sides("padding"),
    margin: sides("margin"),
    paint: capturePaint(styles as unknown as Record<string, string> | null)
  };
};

/**
 * A painted rect mapped back into the space its ancestor's transform is applied
 * FROM.
 *
 * A screen that is mid-flight (or held at its from-pose) carries a transform,
 * so every rect measured inside it is already displaced. The morph's own
 * transform composes with that displacement rather than replacing it, so the
 * travel has to be computed against the element's undisplaced box — otherwise
 * every push under a sliding transition would start the element a screen-width
 * away from where the eye last saw it.
 */
export const untransformRect = (
  painted: MorphRect,
  ancestor: MorphPose,
  ancestorCentre: PosePoint
): MorphRect => {
  const scaleX = ancestor.scaleX === 0 ? 1 : ancestor.scaleX;
  const scaleY = ancestor.scaleY === 0 ? 1 : ancestor.scaleY;
  const centre = rectCentre(painted);
  const untransformedCentre = {
    x: ancestorCentre.x + (centre.x - ancestorCentre.x - ancestor.x) / scaleX,
    y: ancestorCentre.y + (centre.y - ancestorCentre.y - ancestor.y) / scaleY
  };
  const width = painted.width / scaleX;
  const height = painted.height / scaleY;
  return {
    x: untransformedCentre.x - width / 2,
    y: untransformedCentre.y - height / 2,
    width,
    height
  };
};

const MATRIX = /^matrix\(([^)]+)\)$/;
const TRANSLATE = /^translate(?:3d)?\(([^)]+)\)$/;

/**
 * The transform an element is ACTUALLY wearing right now, read off its computed
 * matrix rather than inferred from the variant it is supposed to be playing.
 *
 * Inferring it was a bug with a name: a held screen usually sits at its
 * from-pose, but the destination PARK rules put it at its DESTINATION instead
 * (so the browser rasterises the tiles the animation is about to reveal), and a
 * measurement corrected for a displacement the screen was not wearing lands a
 * screen-height away from where anything is. The matrix is true in every one of
 * those states — parked, held, mid-flight, at rest.
 *
 * Rotation and skew are not represented: nothing in the library rotates a
 * screen, and a rect is not a rotated shape anyway.
 */
export const readElementPose = (element: HTMLElement): MorphPose => {
  if (typeof getComputedStyle !== "function") return { ...IDENTITY_POSE };
  const transform = (getComputedStyle(element).transform ?? "").trim();

  // Every browser resolves a transform to a matrix. Test environments do not
  // always — jsdom hands back the specified value — so the plain translate
  // forms are read too, which is what a screen transition writes anyway.
  const translate = TRANSLATE.exec(transform);
  if (translate) {
    const [rawX, rawY] = translate[1]!.split(",").map((value) => Number.parseFloat(value));
    return {
      x: Number.isFinite(rawX) ? rawX! : 0,
      y: Number.isFinite(rawY) ? rawY! : 0,
      scaleX: 1,
      scaleY: 1,
      rotate: 0
    };
  }

  const match = MATRIX.exec(transform);
  if (!match) return { ...IDENTITY_POSE };
  const parts = match[1]!.split(",").map((value) => Number.parseFloat(value));
  if (parts.length < 6 || parts.some((value) => !Number.isFinite(value))) {
    return { ...IDENTITY_POSE };
  }
  return { x: parts[4]!, y: parts[5]!, scaleX: parts[0]!, scaleY: parts[3]!, rotate: 0 };
};

/**
 * The centre an ancestor's transform is applied about, recovered from its
 * painted rect. Scale leaves the centre where it is, so the translation is the
 * whole difference — which is why this needs no scale term.
 */
export const untransformedCentre = (painted: MorphRect, ancestor: MorphPose): PosePoint => {
  const centre = rectCentre(painted);
  return { x: centre.x - ancestor.x, y: centre.y - ancestor.y };
};

/**
 * The pose that puts `element` exactly where `target` is — the F of FLIP.
 *
 * Both rects live in the same (untransformed) space, and the transform is
 * applied about the element's own centre, so the translation is centre-to-
 * centre and the scale is the size ratio. Returns the identity when either box
 * has no area: an unlaid-out element has no honest travel to compute, and
 * dividing by its zero would produce an infinity that reaches the compositor.
 */

/**
 * The transform that maps one box onto another, about the element's own centre.
 *
 * Only the GHOST uses it. Everything real animates its LAYOUT box so its
 * contents lay themselves out at every size; a copy that is on its way out must
 * do the opposite — keep the layout it was captured with and simply follow,
 * or it re-wraps its own text while the real element re-wraps differently and
 * the two print over each other.
 */
export const followPose = (target: MorphRect, element: MorphRect): MorphPose => {
  if (element.width <= 0 || element.height <= 0) return { ...IDENTITY_POSE };
  const from = rectCentre(element);
  const to = rectCentre(target);
  return {
    x: to.x - from.x,
    y: to.y - from.y,
    scaleX: target.width / element.width,
    scaleY: target.height / element.height,
    rotate: 0
  };
};
