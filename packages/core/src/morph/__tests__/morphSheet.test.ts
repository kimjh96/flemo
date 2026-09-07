import { afterEach, describe, expect, it, vi } from "vitest";

import { MORPH_SHEET_ATTR } from "@dom/attributes";

import { declaredMorphKeyframes, ensurePinnedPoses, insertMorphRules } from "@morph/morphSheet";

// THE PER-FLIGHT SHEET.
//
// A morph's keyframes cannot be compiled with the rest: how far the element
// travels and how much it grows are two rects that exist only once the arriving
// screen has laid out. So they are inserted at the flight's start and dropped
// when it lands — and what has to hold is that a flight drops EXACTLY its own
// rules, since two flights legitimately share the sheet.

const sheetTag = () => document.head.querySelector<HTMLStyleElement>(`style[${MORPH_SHEET_ATTR}]`);

const ruleTexts = () => {
  const rules = sheetTag()?.sheet?.cssRules;
  return rules ? Array.from(rules).map((rule) => rule.cssText) : [];
};

afterEach(() => {
  vi.unstubAllGlobals();
  sheetTag()?.remove();
});

describe("insertMorphRules", () => {
  it("inserts a flight's rules and takes back exactly those", () => {
    const first = insertMorphRules(["@keyframes flemo-morph-a { from { opacity: 0 } }"]);
    const second = insertMorphRules(["@keyframes flemo-morph-b { from { opacity: 0 } }"]);

    expect(ruleTexts()).toHaveLength(2);

    first();

    // The second flight's rule is untouched, and it is found by identity —
    // the first flight's index would by now point at it.
    expect(ruleTexts()).toHaveLength(1);
    expect(ruleTexts()[0]).toContain("flemo-morph-b");

    second();
    expect(ruleTexts()).toHaveLength(0);
  });

  it("reuses one style tag across flights", () => {
    const dispose = insertMorphRules(["@keyframes flemo-morph-c { from { opacity: 0 } }"]);
    insertMorphRules(["@keyframes flemo-morph-d { from { opacity: 0 } }"])();
    expect(document.head.querySelectorAll(`style[${MORPH_SHEET_ATTR}]`)).toHaveLength(1);
    dispose();
  });

  it("survives a rule that is already gone", () => {
    // The landing is not the only thing that can empty the sheet — a hot
    // reload, a consumer clearing the head, or a second disposer call all
    // reach it first. A cleanup that assumed its rule was still there would
    // delete whatever had taken its index.
    const dispose = insertMorphRules(["@keyframes flemo-morph-e { from { opacity: 0 } }"]);
    sheetTag()?.sheet?.deleteRule(0);
    expect(() => dispose()).not.toThrow();
    expect(ruleTexts()).toHaveLength(0);
  });

  it("hands back a no-op disposer where there is no document to insert into", () => {
    // SSR renders a morph's markup and stages no flight, so the sheet is never
    // reached — but the disposer is still called on unmount.
    vi.stubGlobal("document", undefined);
    expect(() =>
      insertMorphRules(["@keyframes flemo-morph-f { from { opacity: 0 } }"])()
    ).not.toThrow();
  });
});

// THE PINNED POSE'S REGISTRATIONS.
//
// Everything else in this sheet belongs to one flight and leaves with it. These
// five do not: a `@property` registration is document-wide, and adding or
// removing one invalidates style for the whole page — the single frame a flight
// has the least room in. So they go in once and stay.
describe("ensurePinnedPoses", () => {
  it("registers the pinned pose's five coordinates", () => {
    const insertRule = vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockReturnValue(0);

    expect(ensurePinnedPoses()).toBe(true);

    const written = insertRule.mock.calls.map(([rule]) => String(rule)).join("\n");
    for (const axis of ["x", "y", "sx", "sy", "r"]) {
      expect(written).toContain(`@property --flemo-pose-${axis}`);
    }
    // `inherits: false` is what keeps two cameras in nested Routers out of each
    // other's values, and what stops a screen's zoom reaching its descendants.
    expect(written).toContain("inherits: false");
    insertRule.mockRestore();
  });

  it("registers once and not again on the next flight", () => {
    const insertRule = vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockReturnValue(0);

    ensurePinnedPoses();
    const after = insertRule.mock.calls.length;
    ensurePinnedPoses();
    ensurePinnedPoses();

    expect(insertRule.mock.calls.length).toBe(after);
    insertRule.mockRestore();
  });

  it("reports a browser that will not take them, so every pose stays literal", () => {
    // Unregistered, those properties are strings: they would animate discretely
    // and jump the zoom at its midpoint rather than interpolating it.
    const insertRule = vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => {
      throw new Error("unknown at-rule");
    });

    expect(ensurePinnedPoses()).toBe(false);
    insertRule.mockRestore();
  });
});

// READING A FLIGHT BACK OUT.
//
// A gesture's release stages the return of a flight it did not compile, and
// the path it needs is not always readable off the animation: an engine can
// answer a compiled animation with its offsets and none of its custom
// properties, which for a pinned pose is the whole travel. The sheet has them.
const fakeAnimation = (name: string, target: HTMLElement) =>
  ({
    animationName: name,
    effect: { target }
  }) as unknown as Animation;

describe("declaredMorphKeyframes", () => {
  it("reads a flight's compiled path, curves and stops included", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    element.id = "flyer";
    insertMorphRules([
      "@keyframes flemo-morph-1-travel { 0%, 30% { --flemo-pose-x: 0px } 60% { --flemo-pose-x: 40px; animation-timing-function: linear } 100% { --flemo-pose-x: 100px } }",
      "#flyer { animation-name: flemo-morph-1-travel; animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1) }"
    ]);

    const frames = declaredMorphKeyframes(fakeAnimation("flemo-morph-1-travel", element));

    expect(frames).toEqual([
      { offset: 0, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pose: { "--flemo-pose-x": "0px" } },
      { offset: 0.3, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pose: { "--flemo-pose-x": "0px" } },
      // A stop's own curve wins for the segment leaving it.
      { offset: 0.6, easing: "linear", pose: { "--flemo-pose-x": "40px" } },
      { offset: 1, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pose: { "--flemo-pose-x": "100px" } }
    ]);
    element.remove();
  });

  it("takes the flyer's curve off the shorthand it was written with", () => {
    // The element in flight carries its animations inline, as one list — so the
    // curve is matched to the name by position rather than found in a rule.
    const element = document.createElement("div");
    document.body.appendChild(element);
    // The runtime writes one `animation` shorthand; jsdom keeps no longhands
    // for it, so the list a browser expands that into is written directly.
    element.style.setProperty("animation-name", "flemo-morph-2-fade, flemo-morph-2-travel");
    element.style.setProperty(
      "animation-timing-function",
      "linear, cubic-bezier(0.32, 0.72, 0, 1)"
    );
    insertMorphRules([
      "@keyframes flemo-morph-2-travel { from { --flemo-pose-x: 0px } to { --flemo-pose-x: 100px } }"
    ]);

    const frames = declaredMorphKeyframes(fakeAnimation("flemo-morph-2-travel", element));

    expect(frames?.map((frame) => frame.easing)).toEqual([
      "cubic-bezier(0.32, 0.72, 0, 1)",
      "cubic-bezier(0.32, 0.72, 0, 1)"
    ]);
    expect(frames?.map((frame) => frame.offset)).toEqual([0, 1]);
    element.remove();
  });

  it("declines an animation this sheet did not compile", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    insertMorphRules([
      "@keyframes flemo-morph-3-travel { from { --flemo-pose-x: 0px } to { --flemo-pose-x: 100px } }"
    ]);

    expect(declaredMorphKeyframes(fakeAnimation("something-else", element))).toBeNull();
    // ...and one whose curve is nowhere to be read: guessing one would put the
    // return on a shape its author never wrote.
    expect(declaredMorphKeyframes(fakeAnimation("flemo-morph-3-travel", element))).toBeNull();
    element.remove();
  });

  it("declines an animation with no element to stage against", () => {
    expect(declaredMorphKeyframes({ effect: null } as unknown as Animation)).toBeNull();
  });
});

// The CSSOM, stood in for where jsdom will not produce the shape under test —
// a rule that refuses to be read, a block with no offset in its key.
const fakeStyle = (declarations: Record<string, string>) => ({
  length: Object.keys(declarations).length,
  item: (index: number) => Object.keys(declarations)[index] ?? "",
  getPropertyValue: (property: string) => declarations[property] ?? ""
});

const withSheet = (rules: unknown) => {
  const tag = document.createElement("style");
  tag.setAttribute(MORPH_SHEET_ATTR, "");
  document.head.appendChild(tag);
  Object.defineProperty(tag, "sheet", {
    get: () => ({
      get cssRules() {
        if (rules === null) throw new Error("cross-origin");
        return rules;
      }
    }),
    configurable: true
  });
  return tag;
};

describe("declaredMorphKeyframes declines", () => {
  const element = () => {
    const created = document.createElement("div");
    document.body.appendChild(created);
    return created;
  };

  it("a sheet that refuses to be read", () => {
    withSheet(null);

    expect(declaredMorphKeyframes(fakeAnimation("flemo-morph-4-travel", element()))).toBeNull();
  });

  it("a curve on a rule that names another animation, or none at all", () => {
    withSheet([
      { name: "flemo-morph-5-travel", cssRules: [{ keyText: "from", style: fakeStyle({}) }] },
      { style: fakeStyle({ "animation-name": "flemo-morph-9-fade" }) },
      { style: fakeStyle({ "animation-name": "flemo-morph-5-travel" }) }
    ]);

    expect(declaredMorphKeyframes(fakeAnimation("flemo-morph-5-travel", element()))).toBeNull();
  });

  it("a block whose key is not an offset", () => {
    const naming = {
      style: fakeStyle({
        "animation-name": "flemo-morph-6-travel",
        "animation-timing-function": "linear"
      })
    };
    const keyed = (keyText: string) => [
      {
        name: "flemo-morph-6-travel",
        cssRules: [
          { keyText, style: fakeStyle({ opacity: "0" }) },
          { keyText: "100%", style: fakeStyle({ opacity: "1" }) }
        ]
      },
      naming
    ];
    const read = (keyText: string) => {
      const tag = withSheet(keyed(keyText));
      const frames = declaredMorphKeyframes(fakeAnimation("flemo-morph-6-travel", element()));
      tag.remove();
      return frames;
    };

    expect(read("entry")).toBeNull();
    expect(read("half%")).toBeNull();
    // ...and the two words that ARE offsets.
    expect(read("from")?.map((frame) => frame.offset)).toEqual([0, 1]);
  });

  it("a path with a single pose in it", () => {
    withSheet([
      {
        name: "flemo-morph-7-travel",
        cssRules: [{ keyText: "to", style: fakeStyle({ opacity: "1" }) }]
      },
      {
        style: fakeStyle({
          "animation-name": "flemo-morph-7-travel",
          "animation-timing-function": "linear"
        })
      }
    ]);

    expect(declaredMorphKeyframes(fakeAnimation("flemo-morph-7-travel", element()))).toBeNull();
  });
});
