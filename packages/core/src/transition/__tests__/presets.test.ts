import { describe, expect, it } from "vitest";

import cupertino from "@transition/cupertino";

import layout from "@transition/layout";
import material from "@transition/material";
import none from "@transition/none";
import { transitionMap } from "@transition/transition";

import { decoratorMap } from "@transition/decorator/decorator";
import overlay from "@transition/decorator/overlay";

describe("transition presets", () => {
  it("cupertino has the expected name + transform-based shape", () => {
    expect(cupertino.name).toBe("cupertino");
    expect(cupertino.initial).toEqual({ x: "100%" });
    expect(cupertino.swipeDirection).toBe("x");
    expect(cupertino.decoratorName).toBe("overlay");
  });

  it("material is named `material` and animates on the y axis", () => {
    expect(material.name).toBe("material");
    expect(material.initial).toHaveProperty("y");
  });

  it("layout is named `layout` and uses opacity (no translation)", () => {
    expect(layout.name).toBe("layout");
    expect(layout.initial).toHaveProperty("opacity");
    expect(layout.initial).not.toHaveProperty("x");
    expect(layout.initial).not.toHaveProperty("y");
  });

  it("none keeps every variant empty (no animatable target)", () => {
    expect(none.name).toBe("none");
    expect(none.initial).toEqual({});
    for (const key of Object.keys(none.variants)) {
      expect(none.variants[key as keyof typeof none.variants].value).toEqual({});
    }
  });

  it("every preset emits all 10 variant keys", () => {
    for (const t of [cupertino, material, layout, none]) {
      expect(Object.keys(t.variants).length).toBe(10);
    }
  });
});

describe("transitionMap registry", () => {
  it("contains the four built-in presets keyed by name", () => {
    expect(transitionMap.get("none")).toBe(none);
    expect(transitionMap.get("cupertino")).toBe(cupertino);
    expect(transitionMap.get("material")).toBe(material);
    expect(transitionMap.get("layout")).toBe(layout);
  });

  it("returns undefined for an unknown name", () => {
    expect(transitionMap.get("does-not-exist" as never)).toBeUndefined();
  });
});

describe("overlay decorator preset", () => {
  it("declares the overlay name and uses opacity + backgroundColor", () => {
    expect(overlay.name).toBe("overlay");
    expect(overlay.initial).toHaveProperty("opacity");
    expect(overlay.initial).toHaveProperty("backgroundColor");
  });

  it("is registered in decoratorMap under its own name", () => {
    expect(decoratorMap.get("overlay")).toBe(overlay);
  });
});
