import { describe, expect, it } from "vitest";

import findScrollable from "@utils/findScrollable";

describe("findScrollable event-target resolution", () => {
  it("resolves the start element through an event's composedPath", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    document.body.appendChild(parent);

    let captured: Event | null = null;
    child.addEventListener("pointerdown", (event) => {
      captured = event;
    });
    child.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));

    const result = findScrollable(captured! as unknown as EventTarget, { direction: "y" });
    expect(result.element).toBeNull(); // nothing scrollable, but resolution didn't throw

    parent.removeChild(child);
    document.body.removeChild(parent);
  });

  it("accepts a bare HTMLElement", () => {
    const element = document.createElement("div");
    const result = findScrollable(element, { direction: "x" });
    expect(result.element).toBeNull();
  });
});
