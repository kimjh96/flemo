// A SHADOW THAT SURVIVES THE REVEAL'S CLIP.
//
// A reveal lays the box out at the size that contains both ends and cuts it
// back with a clip. The clip takes the element's whole rendering with it, and a
// `box-shadow` paints OUTSIDE the border box, so a revealed box loses its
// shadow entirely. That is why a shadow used to refuse the reveal outright, and
// it cost every shadowed card in the wild a layout and a fresh raster of its
// whole subtree on every frame of every transition.
//
// A filter on the element does not help: filters are applied BEFORE the clip,
// so `drop-shadow` is cut away with everything else. Device-measured, both
// ways: the revealed box's shadow reached exactly as far as its own bottom edge
// in each case, which is to say it was not drawn at all.
//
// A filter on a CARRIER around the element does, and that is what this was
// first built to write. It is an approximation twice over. `drop-shadow` has no
// spread, and every shadow in the wild uses one; and a stack of them is applied
// in SEQUENCE, so the second is cast from the first's blurred output rather
// than from the box. Traced through a push, the shadow under the card thinned
// from a tint of 27.6 at rest to 17 for the whole transition and snapped back on
// landing, which is a shadow that pops. It also asks for a Gaussian blur of the
// whole card on every frame, which is the cost the reveal was bought to avoid.
//
// So the carrier is a BOX instead: an empty one, travelling the same rects
// underneath the moving element, wearing the card's own `box-shadow` unchanged
// (see the shade keyframe in morphKeyframes). It is laid out per frame, and
// that is affordable precisely because it holds nothing — there is no subtree
// to lay out, and a shadow has no hard edge for the device grid to step.

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

/**
 * Whether a computed shadow layer paints anything.
 *
 * Tailwind composes every shadow with four empty ring layers
 * (`rgba(0, 0, 0, 0) 0px 0px 0px 0px`), so a box with no shadow at all still
 * computes to a list that is not `none`, and a carrier built for one would be
 * an element and an animation cast for nothing.
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

/** Whether a computed `box-shadow` paints anything at all. */
export const shadowPaints = (shadow: string): boolean => layers(shadow).some(paints);

/**
 * Whether a carrier under the box can cast this shadow.
 *
 * An INSET shadow paints inside the border box, and the revealed border box is
 * the larger end, so it is drawn against the wrong rectangle and no box outside
 * the element can put it right.
 */
export const shadowCarries = (shadow: string): boolean =>
  !layers(shadow).some((layer) => /\binset\b/.test(layer) && paints(layer));
