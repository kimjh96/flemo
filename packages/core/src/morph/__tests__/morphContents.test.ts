import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contentsHoldAcrossBox, type MorphAnchor } from "@morph/morphContents";

const RIGHT: MorphAnchor = { x: "right", y: "top" };
const LEFT: MorphAnchor = { x: "left", y: "top" };
const BOTTOM: MorphAnchor = { x: "right", y: "bottom" };

const own = Element.prototype.getBoundingClientRect;

/**
 * A layout that answers the one question this measures: a child pinned to the
 * box's RIGHT edge stays where it is when the box's width changes, and a child
 * pinned to its LEFT edge does not.
 */
const layout = () => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const box = this as HTMLElement;
    const width = Number.parseFloat(box.style.width || box.dataset.width || "0");
    if (box.dataset.box !== undefined)
      return { left: 0, top: 0, right: width, bottom: 40, width, height: 40 } as DOMRect;
    const size = Number.parseFloat(box.dataset.size ?? "16");
    const outer = Number.parseFloat(
      (box.closest("[data-box]") as HTMLElement | null)?.style.width ?? "0"
    );
    const right = box.dataset.fromRight
      ? outer - Number.parseFloat(box.dataset.fromRight)
      : Number.parseFloat(box.dataset.fromLeft ?? "0") + size;
    return { left: right - size, top: 12, right, bottom: 28, width: size, height: 16 } as DOMRect;
  };
};

const mount = (inner: string) => {
  const host = document.createElement("div");
  host.dataset.box = "";
  host.style.width = "98px";
  host.innerHTML = inner;
  document.body.appendChild(host);
  return host;
};

beforeEach(layout);

afterEach(() => {
  Element.prototype.getBoundingClientRect = own;
  document.body.innerHTML = "";
});

describe("contentsHoldAcrossBox", () => {
  it("holds where every child keeps its distance from the far edge", () => {
    const box = mount(`<span data-from-right="30"></span><span data-from-right="10"></span>`);
    expect(
      contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT)
    ).toBe(true);
  });

  it("does not hold where a child is placed from the near edge", () => {
    const box = mount(`<span data-from-right="10"></span><span data-from-left="12"></span>`);
    expect(
      contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT)
    ).toBe(false);
  });

  it("remembers the answer across the MOUNTS a navigation makes", () => {
    // The arrival is mounted for the navigation, so every push used to hand a
    // WeakMap keyed on the element a node it had never seen, and the probe ran
    // every time. Measured on a bench at 120Hz, that was 7ms of the opening of
    // every push, for an answer already known.
    const markup = `<span data-from-right="10"></span>`;
    const first = mount(markup);
    contentsHoldAcrossBox(first, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT);
    first.remove();

    const again = mount(markup);
    const copies = vi.spyOn(again, "cloneNode");
    contentsHoldAcrossBox(again, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT);

    expect(copies).not.toHaveBeenCalled();
  });

  it("forgets everything once it has remembered too much, rather than growing", () => {
    // A long session keys a new answer per box size; the memory is bounded by
    // starting over, so the first answer is asked again after the reset.
    const markup = `<span data-from-right="10"></span>`;
    const box = mount(markup);
    contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT);
    for (let width = 200; width < 800; width += 1) {
      contentsHoldAcrossBox(box, { width, height: 40 }, { width: 139, height: 40 }, RIGHT);
    }

    const copies = vi.spyOn(box, "cloneNode");
    contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT);
    expect(copies).toHaveBeenCalled();
  });

  it("asks again for a subtree that is not the same subtree", () => {
    // The key is what the answer depends on, so anything that could move a
    // child asks again: a class, an inline style, an attribute, the words.
    const base = { from: { width: 98, height: 40 }, to: { width: 139, height: 40 } };
    const first = mount(`<span data-from-right="10" class="a"></span>`);
    contentsHoldAcrossBox(first, base.from, base.to, RIGHT);
    first.remove();

    for (const markup of [
      `<span data-from-right="10" class="b"></span>`,
      `<span data-from-right="10" class="a" style="margin:2px"></span>`,
      `<span data-from-right="10" class="a">words</span>`
    ]) {
      const next = mount(markup);
      const copies = vi.spyOn(next, "cloneNode");
      contentsHoldAcrossBox(next, base.from, base.to, RIGHT);
      expect(copies, markup).toHaveBeenCalled();
      next.remove();
    }
  });

  it("asks again when the CONTEXT that styles the subtree changes", () => {
    // A theme class on an ancestor can move a child without changing a byte of
    // the subtree, and a remembered answer would then draw a picture the page
    // does not. That is the one thing this rule is not allowed to do.
    const base = { from: { width: 98, height: 40 }, to: { width: 139, height: 40 } };
    const first = mount(`<span data-from-right="10"></span>`);
    contentsHoldAcrossBox(first, base.from, base.to, RIGHT);

    document.documentElement.classList.add("dark");
    const copies = vi.spyOn(first, "cloneNode");
    contentsHoldAcrossBox(first, base.from, base.to, RIGHT);
    document.documentElement.classList.remove("dark");

    expect(copies).toHaveBeenCalled();
  });

  it("measures on a copy and leaves the page as it found it", () => {
    const box = mount(`<span data-from-right="10"></span>`);
    contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT);
    expect(document.body.children).toHaveLength(1);
    expect(box.style.width).toBe("98px");
  });

  it("cannot prove an empty box, and will not claim to", () => {
    expect(
      contentsHoldAcrossBox(mount(""), { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT)
    ).toBe(false);
  });

  it("cannot prove a box that is not on the page", () => {
    const loose = document.createElement("div");
    loose.dataset.box = "";
    loose.innerHTML = `<span data-from-right="10"></span>`;
    expect(
      contentsHoldAcrossBox(loose, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT)
    ).toBe(false);
  });

  it("holds a LEFT-anchored growth whose children keep their distance from that edge", () => {
    // The same subtree, judged from the corner the transition actually anchors on:
    // a box that grows rightward leaves its left-placed children exactly where
    // they were, and measuring from the far edge would call every one of them
    // moved.
    const box = mount(`<span data-from-left="12"></span><span data-from-left="40"></span>`);
    expect(
      contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, LEFT)
    ).toBe(true);
    expect(
      contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT)
    ).toBe(false);
  });

  it("has nothing to answer where neither side of the box changes", () => {
    const box = mount(`<span data-from-right="10"></span>`);
    expect(
      contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 98, height: 40 }, RIGHT)
    ).toBe(false);
  });

  it("measures each child's distance from a bottom-anchored corner", () => {
    // A bottom-left/right growth is read from the bottom edge, the same way a
    // top growth is read from the top: the vertical distance a child keeps from
    // the corner the transition holds, not from the corner it grows toward.
    const box = mount(`<span data-from-right="30"></span><span data-from-right="10"></span>`);
    expect(
      contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, BOTTOM)
    ).toBe(true);
  });

  it("gives up on a subtree too large to walk", () => {
    const many = Array.from({ length: 300 }, () => `<span data-from-right="10"></span>`).join("");
    expect(
      contentsHoldAcrossBox(
        mount(many),
        { width: 98, height: 40 },
        { width: 139, height: 40 },
        RIGHT
      )
    ).toBe(false);
  });

  it("skips whitespace, and stops where a text label cannot be measured", () => {
    // A text label might re-wrap, so a text node whose range cannot be measured
    // leaves the subtree unproven; the walk gives up there and does not vouch
    // for anything after it. Whitespace between elements is not a label and is
    // skipped, not measured.
    const box = mount(`<span>hi</span><span data-from-right="10"></span> `);
    expect(
      contentsHoldAcrossBox(box, { width: 98, height: 40 }, { width: 139, height: 40 }, RIGHT)
    ).toBe(false);
  });
});
