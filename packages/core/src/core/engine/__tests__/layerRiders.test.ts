import { afterEach, describe, expect, it } from "vitest";

import { collectLayerRiders, isRider } from "@core/engine/layerRiders";
import {
  BAR_ATTR,
  BAR_RIDING_ATTR,
  LAYER_HOST_ATTR,
  LAYER_OWNER_ATTR,
  LAYER_SLOT_ATTR,
  SCREEN_ATTR
} from "@dom/attributes";

// What rides beside a scope, and how each class is found.
//
// A riding shared bar and a <Layer> overlay need identical treatment from all
// three drivers — the compiled rule, the engine, the gesture — and differ in
// exactly one thing: a bar never leaves the container it belongs to, so a walk
// of that container finds it, while an overlay does leave. That asymmetry is
// the whole module, so it is what these pin.

const container = (children: HTMLElement[]): HTMLElement => {
  const element = document.createElement("div");
  for (const child of children) element.append(child);
  document.body.append(element);
  return element;
};

const el = (attributes: Record<string, string>, tag = "div"): HTMLElement => {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("collectLayerRiders", () => {
  it("has nothing to collect without a container", () => {
    expect(collectLayerRiders(null)).toEqual([]);
  });

  it("returns the container's OWN host and stops there", () => {
    const host = el({ [LAYER_HOST_ATTR]: "" });
    const slotInside = el({ [LAYER_SLOT_ATTR]: "", [LAYER_OWNER_ATTR]: "screen-1" });
    host.append(slotInside);

    const riders = collectLayerRiders(container([el({ [SCREEN_ATTR]: "screen-1" }), host]));

    // Never both: moving a host and the slots inside it would compose the two
    // writes and send the overlay twice as far as its screen.
    expect(riders).toEqual([host]);
  });

  it("finds a nested screen's slots by the owner they name", () => {
    // The slot is NOT in this container — it is in an ancestor's host, which
    // is the entire point of it — so no walk of this subtree can reach it.
    const mine = el({ [LAYER_SLOT_ATTR]: "", [LAYER_OWNER_ATTR]: "inner" });
    const someoneElses = el({ [LAYER_SLOT_ATTR]: "", [LAYER_OWNER_ATTR]: "outer" });
    container([mine, someoneElses]);

    const riders = collectLayerRiders(container([el({ [SCREEN_ATTR]: "inner" })]));

    expect(riders).toEqual([mine]);
  });

  it("collects every slot a screen owns, not just the first", () => {
    const first = el({ [LAYER_SLOT_ATTR]: "", [LAYER_OWNER_ATTR]: "inner" });
    const second = el({ [LAYER_SLOT_ATTR]: "", [LAYER_OWNER_ATTR]: "inner" });
    container([first, second]);

    expect(collectLayerRiders(container([el({ [SCREEN_ATTR]: "inner" })]))).toEqual([
      first,
      second
    ]);
  });

  it("collects nothing when the container holds no scope", () => {
    expect(collectLayerRiders(container([el({ [BAR_ATTR]: "nav" })]))).toEqual([]);
  });

  it("collects nothing when the scope carries no id to be named by", () => {
    // A scope rendered by an older binding: the attribute is present with an
    // empty value, the way it was before slots needed to name their owner.
    expect(collectLayerRiders(container([el({ [SCREEN_ATTR]: "" })]))).toEqual([]);
  });

  it("looks at the container's own children, never deeper", () => {
    // A screen hosting a NESTED Router has that router's screens inside its
    // scope, so a descendant query would return the nested screen's host and
    // move the wrong box.
    const scope = el({ [SCREEN_ATTR]: "outer" });
    scope.append(el({ [LAYER_HOST_ATTR]: "" }));

    expect(collectLayerRiders(container([scope]))).toEqual([]);
  });
});

describe("isRider", () => {
  it("says no to nothing at all", () => {
    expect(isRider(null)).toBe(false);
    expect(isRider(undefined)).toBe(false);
  });

  it("says yes to a bar the binding opted into this flight", () => {
    expect(isRider(el({ [BAR_ATTR]: "nav", [BAR_RIDING_ATTR]: "true" }))).toBe(true);
  });

  it("says no to a bar whose partner screen owns it", () => {
    // A bar rides only when the partner lacks a match, so the flag is the
    // whole answer for that class.
    expect(isRider(el({ [BAR_ATTR]: "nav", [BAR_RIDING_ATTR]: "false" }))).toBe(false);
  });

  it("says yes to a host and to a slot, with no flag to check", () => {
    // An overlay has exactly one screen and always leaves with it, so being
    // one of the two boxes is the whole answer for that class.
    expect(isRider(el({ [LAYER_HOST_ATTR]: "" }))).toBe(true);
    expect(isRider(el({ [LAYER_SLOT_ATTR]: "" }))).toBe(true);
  });

  it("says no to anything else beside a scope", () => {
    expect(isRider(el({ [SCREEN_ATTR]: "screen-1" }))).toBe(false);
  });
});
