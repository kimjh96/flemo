// WHAT A MORPH CARRIES BESIDES ITS BOX, as a table.
//
// A morph is one element on two screens, and the arriving element is the
// ARRIVAL's tree: on the flight's first frame it is already wearing every one
// of the destination's own values. So any property the two ends set differently
// STEPS at the instant of the tap and then holds, while the box moves for the
// rest of the flight. It reads as two events where the author wrote one.
//
// That failure was found one property at a time — the padding flinch, the type
// that thickened in a single step, the corner that jumped 4px, the surface that
// flipped colour — and each was fixed by adding another branch to the keyframe
// emitter. Which is a list that is only ever as complete as the last thing
// someone happened to notice on glass: a card with a shadow opening into a
// screen without one had exactly the same bug, waiting.
//
// So the list is DATA. Every property here is read from both ends, compared,
// and interpolated when it differs — adding one is a row, not a branch.
//
// Everything in this table rides the PAINT animation, never the geometry one.
// A keyframe listing a property the compositor cannot animate drops that whole
// animation to the main thread, and the travel is the one that must never leave
// it.

export interface PaintChannel {
  /** The property as it is written in a keyframe. */
  property: string;
  /**
   * Read as four sides rather than one value. A shorthand's computed value is
   * empty when the sides disagree, which is exactly the case worth carrying.
   */
  sides?: readonly [string, string, string, string];
}

export const PAINT_CHANNELS: readonly PaintChannel[] = [
  // The corner. It used to be parsed to a single number because the old
  // implementation had to divide it by a scale; nothing is scaled any more, so
  // the computed value travels as it is — which also means a percentage, a
  // per-corner value and an elliptical corner all work now.
  { property: "border-radius" },

  // The surface. `background-image` is deliberately absent: there is no
  // interpolation between two arbitrary images, and the image IS the element's
  // identity — it is the same one at both ends. Its FRAMING is not, so the
  // size and position travel, which is what re-frames a photo as its box
  // changes shape instead of letting it jump at the first frame.
  { property: "background-color" },
  { property: "background-size" },
  { property: "background-position" },

  // Ink.
  { property: "color" },
  { property: "text-shadow" },
  { property: "caret-color" },

  // The edge.
  {
    property: "border-color",
    sides: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"]
  },
  {
    property: "border-width",
    sides: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"]
  },
  { property: "outline-color" },
  { property: "outline-width" },
  { property: "outline-offset" },

  // Depth and effects.
  { property: "box-shadow" },
  { property: "filter" },
  { property: "backdrop-filter" },
  { property: "mix-blend-mode" },

  // Inner spacing that padding does not cover: a flex or grid card whose two
  // ends space their children differently.
  { property: "row-gap" },
  { property: "column-gap" },

  // Replaced content — an <img> morph reframes rather than jumping.
  { property: "object-position" },

  // SVG paint, for a morph that is (or contains) vector art.
  { property: "fill" },
  { property: "stroke" },
  { property: "stroke-width" }
] as const;

// NOT here, and each for a reason:
//
// - `opacity` belongs to the TRANSITION. It is the cross-fade's axis, and the
//   author owns it; carrying it as well would make two authors of one property.
// - `background-image` has no interpolation between arbitrary values, and is
//   the element's identity rather than its state (see above).
// - `min-*` / `max-*` are LIFTED for the flight, not carried: a clamp outranks
//   the animation and would pin the box at one end of it (see attachMorph).
// - `transform` is the flight's own.
// - `font-family`, `border-style`, `text-transform`, `display`, `overflow` and
//   friends are not interpolable at all — CSS has no midpoint for them, so
//   there is nothing to carry.
//
// Where CSS itself cannot interpolate two particular VALUES of a property that
// is listed here (mismatched filter lists, a keyword against a length), it
// falls back to a discrete swap at the midpoint. That is still better than the
// destination's value on the first frame, which is what this table replaced.

/** The camelCase computed-style key for a plain property name. */
const camel = (property: string): string =>
  property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

type Styles = Record<string, string | undefined> | null | undefined;

/** Both ends' values for every channel, keyed by the property a keyframe wants. */
export const capturePaint = (styles: Styles): Record<string, string> => {
  const paint: Record<string, string> = {};
  if (!styles) return paint;
  for (const channel of PAINT_CHANNELS) {
    const value = channel.sides
      ? channel.sides.map((side) => styles[side] ?? "").join(" ")
      : (styles[camel(channel.property)] ?? "");
    if (value.trim().length > 0) paint[channel.property] = value;
  }
  return paint;
};

/**
 * The channels worth animating: present at both ends and different.
 *
 * `exclude` is how a morph transition opts out of one — the built-in `text`
 * preset turns the corner off, because type has none worth moving.
 */
export const paintTravel = (
  from: Record<string, string>,
  to: Record<string, string>,
  exclude?: ReadonlySet<string>
): { property: string; from: string; to: string }[] => {
  const travel: { property: string; from: string; to: string }[] = [];
  for (const channel of PAINT_CHANNELS) {
    if (exclude?.has(channel.property)) continue;
    const start = from[channel.property];
    const end = to[channel.property];
    if (start === undefined || end === undefined || start === end) continue;
    travel.push({ property: channel.property, from: start, to: end });
  }
  return travel;
};
