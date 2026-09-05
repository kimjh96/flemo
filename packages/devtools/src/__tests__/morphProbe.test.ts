import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createMorphProbeState,
  GHOST_BLADE_MS,
  morphActivity,
  morphSheetRuleCount,
  morphTripwires,
  trackMorphAttribute,
  trackMorphNodes
} from "../morphProbe";

// A MORPH THAT DOES NOT PAIR FAILS SILENTLY.
//
// No error, no attribute, no animation, no console line: the element simply
// appears where it belongs, and the navigation looks like one that never had a
// shared element. The runtime writes the pairing key onto every registered
// morph precisely so this probe can group the ends and say so.

const screen = (id: string): HTMLElement => {
  const element = document.createElement("div");
  element.setAttribute("data-flemo-screen", id);
  document.body.appendChild(element);
  return element;
};

const morph = (parent: HTMLElement, key: string, role?: string): HTMLElement => {
  const element = document.createElement("div");
  element.setAttribute("data-flemo-morph", role ?? "");
  element.setAttribute("data-flemo-morph-id", key);
  parent.appendChild(element);
  return element;
};

const ghost = (parent: HTMLElement): HTMLElement => {
  const element = document.createElement("div");
  element.setAttribute("data-flemo-morph-ghost", "");
  parent.appendChild(element);
  return element;
};

const mutation = (over: Partial<MutationRecord>): MutationRecord =>
  ({
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    ...over
  }) as MutationRecord;

const nodes = (list: Node[]): NodeList => list as unknown as NodeList;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the pairing picture", () => {
  it("calls two ends on two screens pairable, and a skip when neither took a role", () => {
    const a = screen("a");
    const b = screen("b");
    morph(a, "hero");
    morph(b, "hero");

    const activity = morphActivity(createMorphProbeState([a, b]), true);
    expect(activity.registered).toBe(2);
    expect(activity.pairable).toEqual(["hero"]);
    expect(activity.flew).toEqual([]);
    expect(activity.skipped).toEqual(["hero"]);
  });

  it("takes a stamped role as proof the pair flew", () => {
    const a = screen("a");
    const b = screen("b");
    morph(a, "hero", "enter");
    morph(b, "hero", "exit");

    const activity = morphActivity(createMorphProbeState([a, b]), true);
    expect(activity.flew).toEqual(["hero"]);
    expect(activity.skipped).toEqual([]);
  });

  it("ignores an end in a screen this flight is not moving", () => {
    const a = screen("a");
    const deep = screen("deep");
    morph(a, "hero");
    morph(deep, "hero");

    // Only `a` is in the flight, so the deep screen's end is not a partner.
    const activity = morphActivity(createMorphProbeState([a]), true);
    expect(activity.pairable).toEqual([]);
    expect(activity.skipped).toEqual([]);
  });

  it("pairs a screen's end with chrome that belongs to no screen", () => {
    const a = screen("a");
    morph(a, "title");
    // A shared bar is rendered beside the screen scope, not inside it.
    const chrome = document.createElement("div");
    document.body.appendChild(chrome);
    morph(chrome, "title");

    expect(morphActivity(createMorphProbeState([a]), true).pairable).toEqual(["title"]);
  });

  it("names a key used twice inside ONE screen rather than calling it a pair", () => {
    const a = screen("a");
    morph(a, "card");
    morph(a, "card");

    const activity = morphActivity(createMorphProbeState([a]), true);
    expect(activity.pairable).toEqual([]);
    expect(activity.duplicatedKeys).toEqual(["card"]);
  });

  it("skips an end with no pairing key at all", () => {
    const a = screen("a");
    const element = document.createElement("div");
    element.setAttribute("data-flemo-morph", "");
    a.appendChild(element);

    const activity = morphActivity(createMorphProbeState([a]), true);
    expect(activity.registered).toBe(1);
    expect(activity.pairable).toEqual([]);
  });

  it("takes a role stamped mid-flight, and a camera, as they are written", () => {
    const a = screen("a");
    const b = screen("b");
    const end = morph(a, "hero");
    morph(b, "hero");
    const state = createMorphProbeState([a, b]);
    expect(state.flew.size).toBe(0);

    end.setAttribute("data-flemo-morph", "enter");
    trackMorphAttribute(state, end);
    const camera = document.createElement("div");
    camera.setAttribute("data-flemo-morph-camera", "3c");
    document.body.appendChild(camera);
    trackMorphAttribute(state, camera);

    const activity = morphActivity(state, true);
    expect(activity.flew).toEqual(["hero"]);
    expect(activity.camera).toBe(true);
  });

  it("ignores an attribute mutation on an element that is not flying", () => {
    const a = screen("a");
    const end = morph(a, "hero");
    const state = createMorphProbeState([a]);
    trackMorphAttribute(state, end);
    expect(morphActivity(state, true).flew).toEqual([]);
  });
});

describe("ghosts", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = screen("layer");
  });

  it("counts a ghost once, however it arrives", () => {
    const state = createMorphProbeState([host]);
    const wrapper = document.createElement("div");
    const inner = ghost(wrapper);
    trackMorphNodes(state, mutation({ addedNodes: nodes([wrapper]) }), 10);
    trackMorphNodes(state, mutation({ addedNodes: nodes([inner]) }), 12);
    expect(morphActivity(state, true).ghosts).toBe(1);
  });

  it("times a ghost cut inside a frame and reports it as the blade", () => {
    const state = createMorphProbeState([host]);
    const cut = ghost(host);
    trackMorphNodes(state, mutation({ addedNodes: nodes([cut]) }), 100);
    trackMorphNodes(state, mutation({ removedNodes: nodes([cut]) }), 100 + GHOST_BLADE_MS - 20);

    const hits = morphTripwires(state);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("ghost-cut");
    expect(hits[0].detail).toContain("first-frame");
  });

  it("says nothing about a ghost that lived a normal flight", () => {
    const state = createMorphProbeState([host]);
    const lived = ghost(host);
    trackMorphNodes(state, mutation({ addedNodes: nodes([lived]) }), 0);
    trackMorphNodes(state, mutation({ removedNodes: nodes([lived]) }), 400);
    expect(morphTripwires(state)).toEqual([]);
  });

  it("ignores a removal it never saw arrive, and non-element nodes", () => {
    const state = createMorphProbeState([host]);
    const unseen = ghost(host);
    trackMorphNodes(state, mutation({ removedNodes: nodes([unseen]) }), 50);
    trackMorphNodes(state, mutation({ addedNodes: nodes([document.createTextNode("x")]) }), 50);
    expect(morphTripwires(state)).toEqual([]);
    expect(morphActivity(state, true).ghosts).toBe(0);
  });
});

describe("residue at rest", () => {
  it("counts nothing while another flight is already running", () => {
    const a = screen("a");
    morph(a, "hero", "enter");
    const activity = morphActivity(createMorphProbeState([a]), true);
    expect(activity.strandedRoles).toBe(0);
    expect(activity.layerResidue).toBe(0);
  });

  it("counts roles, stand-ins, ghosts and layer corpses once the page is at rest", () => {
    const a = screen("a");
    const state = createMorphProbeState([a]);
    morph(a, "hero", "enter");
    const standIn = document.createElement("div");
    standIn.setAttribute("data-flemo-morph-stand-in", "");
    a.appendChild(standIn);
    ghost(a);
    const layer = document.createElement("div");
    layer.setAttribute("data-flemo-morph-layer", "");
    layer.appendChild(document.createElement("span"));
    layer.appendChild(document.createElement("span"));
    document.body.appendChild(layer);

    const activity = morphActivity(state, false);
    expect(activity.strandedRoles).toBe(1);
    expect(activity.strandedStandIns).toBe(1);
    expect(activity.strandedGhosts).toBe(1);
    expect(activity.layerResidue).toBe(2);
  });

  it("reads a leak as rules the flight added and never dropped", () => {
    const style = document.createElement("style");
    style.setAttribute("data-flemo-morph-sheet", "");
    document.head.appendChild(style);
    const state = createMorphProbeState([screen("a")]);
    expect(state.sheetRulesAtStart).toBe(morphSheetRuleCount());

    style.sheet?.insertRule("@keyframes flemo-morph-1-travel { from { opacity: 0 } }", 0);
    expect(morphActivity(state, false).leakedSheetRules).toBe(1);
    style.remove();
  });

  it("reads no rules at all when there is no sheet", () => {
    expect(morphSheetRuleCount()).toBe(0);
  });
});
