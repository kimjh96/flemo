// A SHADOW THAT SURVIVES THE REVEAL'S CLIP.
//
// A reveal lays the box out at the size that contains both ends and cuts it
// back with a clip. The clip takes the element's whole rendering with it, and a
// `box-shadow` paints OUTSIDE the border box, so a revealed box loses its
// shadow entirely. That is why a shadow used to refuse the reveal outright, and
// it cost every shadowed card in the wild a layout and a fresh raster of its
// subtree on every frame of every flight.
//
// A filter on the element does not help: filters are applied BEFORE the clip,
// so `drop-shadow` is cut away with everything else. Device-measured, both
// ways: the revealed box's shadow reached exactly as far as its own bottom edge
// in each case, which is to say it was not drawn at all.
//
// A filter on a CARRIER around the element does. The carrier paints nothing of
// its own; it casts the shadow of whatever silhouette the clip leaves its
// child, which is the visible box at every size on the way. Measured against a
// box actually laid out at the smaller size, the shadow reached 163px where the
// laid-out one reached 159.5px, the difference being the spread that
// `drop-shadow` has no argument for and that the blur below takes over.

/** Top-level comma split: a colour function's own commas stay in their layer. */
const layers = (value: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      out.push(value.slice(from, index));
      from = index + 1;
    }
  }
  out.push(value.slice(from));
  return out;
};

/** The colour at the head of a computed shadow layer, and the rest of it. */
const split = (layer: string): { colour: string; lengths: string[] } | null => {
  const text = layer.trim();
  if (text === "" || text === "none") return null;
  // An engine may report the colour as the page's own `color` and leave the
  // layer as lengths alone. A `drop-shadow` with no colour takes `color` too,
  // which is the rule the shadow was already following.
  const colour = /^[a-z-]+\([^()]*\)|^#[0-9a-f]+|^[a-z]+/i.exec(text);
  const rest = colour ? text.slice(colour[0].length) : text;
  const lengths = rest
    .trim()
    .split(/\s+/)
    .filter((part) => part !== "" && part !== "inset");
  return { colour: colour ? colour[0] : "", lengths };
};

const value = (text: string | undefined): number =>
  text === undefined ? 0 : (Number.parseFloat(text) ?? 0) || 0;

/**
 * Whether a computed shadow layer paints anything.
 *
 * Tailwind composes every shadow with four empty ring layers
 * (`rgba(0, 0, 0, 0) 0px 0px 0px 0px`), so a box with no shadow at all still
 * computes to a list that is not `none`.
 */
const paints = (layer: string): boolean => {
  const text = layer.trim();
  if (text === "" || text === "none" || /\btransparent\b/.test(text)) return false;
  const colour = /[a-z-]+\(([^()]*)\)/.exec(text);
  if (colour) {
    const channels = colour[1]!;
    const slash = channels.split("/");
    const commas = channels.split(",");
    const alpha = slash.length > 1 ? slash[1] : commas.length === 4 ? commas[3] : undefined;
    if (alpha !== undefined && Number.parseFloat(alpha) === 0) return false;
  }
  const lengths = text.replace(/[a-z-]+\([^()]*\)/g, "").match(/-?\d*\.?\d+px/g) ?? [];
  return lengths.some((length) => Number.parseFloat(length) !== 0);
};

const round = (number: number): string =>
  `${Math.abs(number) < 0.001 ? 0 : Math.round(number * 1000) / 1000}px`;

/**
 * A computed `box-shadow` as the `filter` a carrier wears in its place.
 *
 * `drop-shadow` has no spread, and a spread is the difference between a shadow
 * that hugs its box and one that stands off it. It is folded into the blur
 * instead: a shadow reaches about half its blur past the box, plus its spread,
 * so a blur of `blur + 2 * spread` reaches the same distance with no spread at
 * all. That is exact at the shadow's edge, which is the part a reader sees, and
 * approximate in the middle of the falloff, which is the part nobody can.
 *
 * Returns `none` where nothing paints, so a box whose only shadow is a stack of
 * empty ring layers wears no filter rather than an empty one.
 */
export const shadowAsFilter = (shadow: string): string => {
  const drops: string[] = [];
  for (const layer of layers(shadow)) {
    if (!paints(layer)) continue;
    const parts = split(layer);
    if (!parts) continue;
    const [x, y, blur, spread] = parts.lengths;
    const reach = Math.max(0, value(blur) + 2 * value(spread));
    const geometry = `${round(value(x))} ${round(value(y))} ${round(reach)}`;
    drops.push(`drop-shadow(${parts.colour === "" ? geometry : `${geometry} ${parts.colour}`})`);
  }
  return drops.length > 0 ? drops.join(" ") : "none";
};

/** Whether a computed `box-shadow` paints anything at all. */
export const shadowPaints = (shadow: string): boolean => layers(shadow).some(paints);
