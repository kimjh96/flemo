/**
 * WHETHER A BOX'S CONTENTS MOVE WHEN THE BOX CHANGES SIZE.
 *
 * Animating a morph's box is what makes it a growth rather than a stretch: the
 * subtree lays itself out at every size on the way, which is the only way text
 * can re-wrap into its new shape. That is a layout and a fresh raster of the
 * subtree on every frame, and WebKit re-snaps the backing to the device grid
 * each time, so a subtree that does not need to move gets carried a device
 * pixel back and forth for the whole flight anyway.
 *
 * Measured on a consumer's pill: every descendant held ONE position for all
 * twenty-three frames of the flight, and only the box's own near edge moved.
 * Right-aligned contents in a box that grows leftward do not go anywhere. The
 * per-frame layout produced no layout change at all, and the tremble was the
 * whole of what it bought.
 *
 * Where that is TRUE, holding the box at the size that contains both ends and
 * cutting the near edge back with a clip is the same picture, drawn once. Where
 * it is FALSE the flight must animate the box for real, because something
 * inside genuinely has a different place at the two ends.
 *
 * This is the difference between measuring that and guessing it from the box's
 * shape. A shape says nothing about a consumer's subtree; two laid-out ends do.
 */

/** The engine's own ruler. Anything below it is not a position. */
const TICK = 1 / 64;

/**
 * Enough of a subtree to be sure, and a stop so a page-sized morph cannot turn
 * a flight's setup into a walk of the whole document.
 */
const LIMIT = 256;

const whitespace = /^\s*$/;

/** The corner a flight's box is anchored on, and grows away from. */
export interface MorphAnchor {
  x: "left" | "right";
  y: "top" | "bottom";
}

/**
 * Every child's place and size, measured FROM THE CORNER THE FLIGHT HOLDS.
 *
 * A box grows AWAY from the corner it is anchored on, so that corner is the
 * origin the two measurements can be compared in: a child that sits the same
 * distance from it with the same box at both sizes is a child that does not
 * move. Measured from any other corner, a child that never moved reads as
 * having travelled the whole growth.
 */
const places = (root: Element, anchor: MorphAnchor): number[] | null => {
  const box = root.getBoundingClientRect();
  const from = (rect: DOMRect) => [
    anchor.x === "right" ? box.right - rect.right : rect.left - box.left,
    anchor.y === "bottom" ? box.bottom - rect.bottom : rect.top - box.top
  ];
  const out: number[] = [];
  let overflowed = false;
  const visit = (node: Element) => {
    if (overflowed) return;
    for (const child of node.children) {
      if (out.length >= LIMIT * 4) {
        overflowed = true;
        return;
      }
      const rect = child.getBoundingClientRect();
      out.push(...from(rect), rect.width, rect.height);
      visit(child);
    }
    // TEXT RE-WRAPS WITHOUT MOVING A SINGLE ELEMENT.
    //
    // A label is usually a text node, not a box: its element keeps one rect at
    // both ends while the lines inside it break somewhere else entirely. So the
    // text itself is measured, by the line boxes it actually occupies.
    for (const child of node.childNodes) {
      if (child.nodeType !== 3 || whitespace.test((child as Text).data)) continue;
      const range = node.ownerDocument.createRange();
      if (typeof range.getClientRects !== "function") {
        // A text node this cannot measure is a text node that might re-wrap, so
        // the subtree is unproven rather than unchanged.
        overflowed = true;
        return;
      }
      range.selectNodeContents(child);
      const lines = Array.from(range.getClientRects());
      out.push(lines.length);
      for (const line of lines) out.push(...from(line), line.width);
    }
  };
  visit(root);
  return overflowed ? null : out;
};

/**
 * Whether the box's own subtree lands in the same places at both of its sizes.
 *
 * THE QUESTION IS ABOUT ONE SUBTREE, NOT TWO. A hand-over has two elements, but
 * the one that FLIES is the arrival, and the departure's picture is carried by
 * a ghost stacked over it. Comparing the two subtrees answers a different
 * question and usually answers it "no", because the reason a box grows at all
 * is that the two ends hold different things.
 *
 * So the arrival is asked about itself, on a copy, at the two sizes its own
 * flight will pass through. The copy is laid out beside the original and taken
 * straight back out, so nothing on the page moves to answer this.
 */
/**
 * ASKED ONCE PER SHAPE, NOT ONCE PER FLIGHT.
 *
 * The answer is a fact about a subtree at two sizes, and the same pair flies the
 * same two sizes every time a consumer taps the same card. Laying a copy out
 * twice is two forced layouts, and they happen in the FIRST frame of the
 * flight, which already carries the arriving screen's whole commit: measured on
 * a consumer's app, that frame ran 57ms against 15ms for every frame after it,
 * and nothing moves until it ends.
 *
 * KEYED BY THE SUBTREE, NOT BY THE ELEMENT. It was a WeakMap on the arriving
 * element, and an arrival is MOUNTED for the navigation, so every push handed
 * it a node it had never seen and the probe ran every time. Measured on the
 * composition bench at 120Hz: the opening of a push ran 29.0ms against 21.6ms
 * with the reveal refused, and 141 forced style-and-layout passes against 108 —
 * the whole difference being a probe whose answer was already known.
 *
 * The key is what the answer actually depends on: the two sizes, the corner the
 * flight is anchored on, and the SHAPE of the subtree. The shape is read
 * without touching layout — tag, class and the length of each run of text — so
 * a card whose words changed asks again and one that is the same card at the
 * same two sizes does not.
 */
const answered = new Map<string, boolean>();

/** A cap, so a page of many cards cannot grow this without end. */
const REMEMBERED = 512;

/**
 * What the subtree looks like, without laying anything out.
 *
 * Tag, EVERY attribute, and the length of each run of text, in document order.
 * Every attribute, because a class is not the only thing that decides where a
 * child lands: an inline style, a width, a hidden, a data-* a consumer styles
 * on. Two subtrees that agree on all of it, at the same two sizes, lay out the
 * same; anything that would move a child changes one of them.
 */
const shapeOf = (root: Element): string => {
  const parts: string[] = [];
  const mark = (node: Element): string => {
    const attributes = Array.from(
      node.attributes,
      (attribute) => `${attribute.name}=${attribute.value}`
    );
    attributes.sort();
    return `${node.tagName}[${attributes.join(";")}]`;
  };
  const visit = (node: Element): void => {
    if (parts.length >= LIMIT) return;
    for (const child of node.children) {
      if (parts.length >= LIMIT) return;
      parts.push(mark(child));
      visit(child);
    }
    for (const child of node.childNodes) {
      if (child.nodeType !== 3) continue;
      const text = (child as Text).data;
      if (whitespace.test(text)) continue;
      parts.push(`#${text.trim().length}`);
    }
  };
  parts.push(mark(root));
  visit(root);
  return parts.join("|");
};

export const contentsHoldAcrossBox = (
  element: HTMLElement,
  from: { width: number; height: number },
  to: { width: number; height: number },
  anchor: MorphAnchor
): boolean => {
  const parent = element.parentElement;
  if (!parent || !element.isConnected) return false;
  if (Math.abs(from.width - to.width) < TICK && Math.abs(from.height - to.height) < TICK)
    return false;
  const shape =
    `${from.width.toFixed(1)}x${from.height.toFixed(1)}>${to.width.toFixed(1)}x${to.height.toFixed(1)}` +
    `|${anchor.x}${anchor.y}|${shapeOf(element)}`;
  const remembered = answered.get(shape);
  if (remembered !== undefined) return remembered;
  const probe = element.cloneNode(true) as HTMLElement;
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.left = "0";
  probe.style.top = "0";
  probe.style.margin = "0";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.animation = "none";
  probe.style.transition = "none";
  parent.appendChild(probe);
  const lay = (size: { width: number; height: number }) => {
    probe.style.width = `${size.width}px`;
    probe.style.height = `${size.height}px`;
    return places(probe, anchor);
  };
  let before: number[] | null = null;
  let after: number[] | null = null;
  try {
    before = lay(from);
    after = lay(to);
  } finally {
    probe.remove();
  }
  // Nothing inside to compare is not proof that nothing moves: an empty box
  // that changes size has no contents, and a subtree this could not walk has
  // contents it did not see.
  const holds =
    before !== null &&
    after !== null &&
    before.length > 0 &&
    before.length === after.length &&
    before.every((value, index) => Math.abs(value - after[index]!) <= TICK);
  if (answered.size > REMEMBERED) answered.clear();
  answered.set(shape, holds);
  return holds;
};
