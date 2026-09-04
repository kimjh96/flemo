import { PART_NAME_ATTR } from "@dom/attributes";

/**
 * A PART IS NOT LAID OUT AT THE SIZES THE BOX PASSES THROUGH.
 *
 * A morph's box animates so that the subtree can lay itself out at every size
 * on the way, which is what makes the artwork and the paired type GROW. A
 * `<Part>` is the opposite declaration: it is the content that is NOT paired,
 * that the flight hides and brings back on its own clock, precisely because it
 * has no business being laid out at a cell's width.
 *
 * It was laid out there anyway. The part's own box still rode the growing box,
 * so a page of copy inside a card re-wrapped the whole way up, and the part is
 * brought back before the box has finished growing. Measured on the reference
 * detail, frame by frame: the body copy stood at 147.88px tall for the first
 * twenty frames of the flight, dropped a line to 126.75px on the twenty-first,
 * and the facts list and the buy button under it jumped 23.55px up the screen
 * in that one frame, with the copy already at full opacity.
 *
 * So a part is laid out ONCE, at the width it will rest at, and the box's
 * growth is a clip over it rather than a re-wrap of it. Nothing is lost: the
 * part is not on glass at those sizes, and where it is on glass the width is
 * the one it lands at.
 *
 * The width alone. A part's HEIGHT is where the growth actually shows through
 * to the parts below it, and holding that would pin a subtree to a height its
 * own copy no longer needs.
 */
export const pinPartWidths = (element: HTMLElement): (() => void) => {
  const undo: (() => void)[] = [];
  for (const part of element.querySelectorAll<HTMLElement>(`[${PART_NAME_ATTR}]`)) {
    const { width } = part.getBoundingClientRect();
    // A part with no box has nothing to hold, and reading one back as zero is
    // an engine that cannot answer rather than a part that is empty.
    if (!(width > 0)) continue;
    const own = part.style.width;
    part.style.width = `${width}px`;
    undo.push(() => {
      if (own) part.style.width = own;
      else part.style.removeProperty("width");
    });
  }
  return () => {
    for (const restore of undo) restore();
  };
};
