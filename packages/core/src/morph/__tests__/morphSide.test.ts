import { afterEach, describe, expect, it } from "vitest";

import { DESK_HEAD_ATTR, GOVERNED_ATTR } from "@dom/attributes";

import { headSeconds } from "@morph/morphSide";

// The head kit is announced by an attribute on the root, and the engine stamps
// it from the SAME commit a morph is staged in — after the morph, because React
// runs a descendant's layout effect first. A morph that read the attribute read
// the PREVIOUS flight's answer: right by luck from the second navigation on,
// and wrong on the first, which ran a first push's element 33ms ahead of the
// screen carrying it while every push after it was aligned.
describe("headSeconds", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(DESK_HEAD_ATTR);
    document.documentElement.removeAttribute(GOVERNED_ATTR);
  });

  it("is read from the routing, not from the root's attribute", () => {
    // jsdom is neither a desktop Mac WebKit nor a governed touch session, so
    // the routing says there is no head — whatever the DOM claims.
    document.documentElement.setAttribute(DESK_HEAD_ATTR, "true");
    document.documentElement.setAttribute(GOVERNED_ATTR, "true");

    expect(headSeconds("PUSHING")).toBe(0);
    expect(headSeconds("POPPING")).toBe(0);
  });
});
