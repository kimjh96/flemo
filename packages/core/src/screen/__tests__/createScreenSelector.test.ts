import { describe, expect, it } from "vitest";

import type { History } from "@history/store";

import createScreenSelector from "@screen/createScreenSelector";

const h = (id: string, transitionName = "cupertino"): History => ({
  id,
  pathname: `/${id}`,
  params: {},
  transitionName: transitionName as History["transitionName"],
  layoutId: null
});

describe("createScreenSelector", () => {
  it("marks the entry at `index` active and entry 0 root", () => {
    const sel = createScreenSelector([h("a"), h("b"), h("c")], 1);
    expect(sel.map((s) => s.isActive)).toEqual([false, true, false]);
    expect(sel.map((s) => s.isRoot)).toEqual([true, false, false]);
    expect(sel.map((s) => s.zIndex)).toEqual([0, 1, 2]);
  });

  it("marks screens more than one below the top as prev", () => {
    // index 3: isPrev when zIndex < index - 1, i.e. zIndex < 2 → [0, 1]
    const sel = createScreenSelector([h("a"), h("b"), h("c"), h("d")], 3);
    expect(sel.map((s) => s.isPrev)).toEqual([true, true, false, false]);
  });

  it("gives every screen the active top's transitionName and the one below as prev", () => {
    const sel = createScreenSelector([h("a", "none"), h("b", "material"), h("c", "slide")], 2);
    expect(sel.map((s) => s.transitionName)).toEqual(["slide", "slide", "slide"]);
    expect(sel.map((s) => s.prevTransitionName)).toEqual(["material", "material", "material"]);
  });

  it("preserves the underlying history fields", () => {
    const sel = createScreenSelector([h("a")], 0);
    expect(sel[0].id).toBe("a");
    expect(sel[0].pathname).toBe("/a");
    expect(sel[0].layoutId).toBeNull();
  });
});
