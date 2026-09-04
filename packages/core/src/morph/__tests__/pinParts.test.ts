import { afterEach, describe, expect, it } from "vitest";

import { PART_NAME_ATTR } from "@dom/attributes";
import { pinPartWidths } from "@morph/pinParts";

const own = Element.prototype.getBoundingClientRect;

const mount = (widths: (number | null)[]) => {
  const host = document.createElement("div");
  for (const width of widths) {
    const part = document.createElement("div");
    part.setAttribute(PART_NAME_ATTR, "card-body");
    part.getBoundingClientRect = () => ({ width: width ?? 0, height: 40 }) as DOMRect;
    host.appendChild(part);
  }
  document.body.appendChild(host);
  return host;
};

afterEach(() => {
  Element.prototype.getBoundingClientRect = own;
  document.body.innerHTML = "";
});

describe("pinPartWidths", () => {
  it("holds each part at the width it was laid out at", () => {
    const host = mount([198, 132]);
    pinPartWidths(host);
    expect([...host.children].map((part) => (part as HTMLElement).style.width)).toEqual([
      "198px",
      "132px"
    ]);
  });

  it("lets go of a width the part did not have of its own", () => {
    const host = mount([198]);
    pinPartWidths(host)();
    expect(host.firstElementChild!.getAttribute("style")).toBe("");
  });

  it("gives an authored width back rather than dropping it", () => {
    const host = mount([198]);
    (host.firstElementChild as HTMLElement).style.width = "12rem";
    pinPartWidths(host)();
    expect((host.firstElementChild as HTMLElement).style.width).toBe("12rem");
  });

  it("leaves a part the engine cannot measure alone", () => {
    const host = mount([null]);
    pinPartWidths(host);
    expect((host.firstElementChild as HTMLElement).style.width).toBe("");
  });
});
