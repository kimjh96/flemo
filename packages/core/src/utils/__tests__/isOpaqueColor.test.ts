import { describe, expect, it } from "vitest";

import isOpaqueColor from "@utils/isOpaqueColor";

describe("isOpaqueColor", () => {
  it("accepts opaque computed colors", () => {
    expect(isOpaqueColor("rgb(255, 255, 255)")).toBe(true);
    expect(isOpaqueColor("rgba(10, 20, 30, 1)")).toBe(true);
    expect(isOpaqueColor("rgb(0 0 0 / 1)")).toBe(true);
    expect(isOpaqueColor("color(srgb 1 1 1)")).toBe(true);
  });

  it("rejects translucent and transparent colors", () => {
    expect(isOpaqueColor("rgba(0, 0, 0, 0)")).toBe(false);
    expect(isOpaqueColor("rgba(0, 0, 0, 0.9)")).toBe(false);
    expect(isOpaqueColor("rgb(0 0 0 / 0.5)")).toBe(false);
    expect(isOpaqueColor("color(srgb 0 0 0 / 50%)")).toBe(false);
    expect(isOpaqueColor("transparent")).toBe(false);
  });

  it("is conservative on anything unparseable", () => {
    expect(isOpaqueColor("")).toBe(false);
    expect(isOpaqueColor("var(--color-bg)")).toBe(false);
    expect(isOpaqueColor("linear-gradient(red, blue)")).toBe(false);
  });
});
