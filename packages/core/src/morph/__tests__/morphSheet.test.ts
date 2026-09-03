import { afterEach, describe, expect, it, vi } from "vitest";

import { MORPH_SHEET_ATTR } from "@dom/attributes";

import { ensurePinnedPoses, insertMorphRules } from "@morph/morphSheet";

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
