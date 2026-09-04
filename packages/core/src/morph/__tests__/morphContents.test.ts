import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { contentsHoldAcrossBox, type MorphAnchor } from "@morph/morphContents";

const RIGHT: MorphAnchor = { x: "right", y: "top" };
const LEFT: MorphAnchor = { x: "left", y: "top" };

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
    // The same subtree, judged from the corner the flight actually anchors on:
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
});
