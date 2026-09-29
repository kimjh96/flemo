import { afterEach, describe, expect, it, vi } from "vitest";

const blink = vi.hoisted(() => ({ value: true }));
vi.mock("@platform/engineProbes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/engineProbes")>()),
  detectBlinkEngine: () => blink.value
}));

import { promoteTravelLayer } from "@morph/travelLayer";

// A flight's element is moved by `translate`; without a layer of its own Blink
// paints it into its container on whole device pixels, and the slow end of the
// flight steps a pixel at a time. The layer is what lets it land fractionally.
describe("promoteTravelLayer", () => {
  afterEach(() => {
    blink.value = true;
  });

  it("adds transform to the flight's own will-change list", () => {
    const element = document.createElement("div");
    element.style.willChange = "left, top, width, height";
    promoteTravelLayer(element);
    expect(element.style.willChange).toBe("left, top, width, height, transform");
  });

  it("promotes an element that declared nothing", () => {
    const element = document.createElement("div");
    promoteTravelLayer(element);
    expect(element.style.willChange).toBe("transform");

    const auto = document.createElement("div");
    auto.style.willChange = "auto";
    promoteTravelLayer(auto);
    expect(auto.style.willChange).toBe("transform");
  });

  it("does not list transform twice", () => {
    const element = document.createElement("div");
    element.style.willChange = "transform, opacity";
    promoteTravelLayer(element);
    promoteTravelLayer(element);
    expect(element.style.willChange).toBe("transform, opacity");
  });

  it("leaves WebKit alone, where it has not been looked at", () => {
    blink.value = false;
    const element = document.createElement("div");
    element.style.willChange = "left, top";
    promoteTravelLayer(element);
    expect(element.style.willChange).toBe("left, top");
  });
});
