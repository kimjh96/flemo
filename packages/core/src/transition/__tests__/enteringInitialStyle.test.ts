import { describe, expect, it } from "vitest";

import enteringInitialStyle from "@transition/enteringInitialStyle";

describe("enteringInitialStyle", () => {
  it("holds an actively entering screen at its initial transform/opacity", () => {
    expect(
      enteringInitialStyle({
        initial: { x: "100%", opacity: 0 },
        isActive: true,
        status: "PUSHING"
      })
    ).toEqual({ transform: "translateX(100%)", opacity: "0" });
  });

  it("appends px to numeric offsets", () => {
    expect(
      enteringInitialStyle({ initial: { x: 300 }, isActive: true, status: "REPLACING" })
    ).toEqual({ transform: "translateX(300px)" });
    expect(enteringInitialStyle({ initial: { y: 40 }, isActive: true, status: "PUSHING" })).toEqual(
      {
        transform: "translateY(40px)"
      }
    );
  });

  it("supports a vertical string offset", () => {
    expect(
      enteringInitialStyle({ initial: { y: "-20%" }, isActive: true, status: "PUSHING" })
    ).toEqual({ transform: "translateY(-20%)" });
  });

  it("is empty for an inactive screen", () => {
    expect(
      enteringInitialStyle({ initial: { x: "100%" }, isActive: false, status: "PUSHING" })
    ).toEqual({});
  });

  it("is empty outside push/replace (rest rules or keyframes own those)", () => {
    expect(
      enteringInitialStyle({ initial: { x: "100%" }, isActive: true, status: "POPPING" })
    ).toEqual({});
    expect(
      enteringInitialStyle({ initial: { x: "100%" }, isActive: true, status: "COMPLETED" })
    ).toEqual({});
  });
});
