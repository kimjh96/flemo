import { describe, expect, it } from "vitest";

import { perceptualCutMs } from "@core/engine/perceptualSpan";

const box = { clientWidth: 390, clientHeight: 720 };
const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as [number, number, number, number];

const slide = (overrides: object = {}) => ({
  from: { x: "100%" },
  to: { x: 0 },
  duration: 0.6,
  delay: 0,
  ease: CUPERTINO_EASE,
  ...overrides
});

describe("perceptualCutMs", () => {
  it("cuts a cupertino-shaped slide well before its asymptotic tail ends", () => {
    const cut = perceptualCutMs(slide(), box, 2);
    expect(cut).not.toBeNull();
    expect(cut!).toBeGreaterThan(350);
    expect(cut!).toBeLessThan(585);
  });

  it("cuts earlier on a coarser display (larger device pixel)", () => {
    const fine = perceptualCutMs(slide(), box, 3);
    const coarse = perceptualCutMs(slide(), box, 1);
    expect(fine).not.toBeNull();
    expect(coarse).not.toBeNull();
    expect(coarse!).toBeLessThan(fine!);
  });

  it("handles opacity channels with the 8-bit step threshold", () => {
    const fade = {
      from: { opacity: 0 },
      to: { opacity: 1 },
      duration: 0.3,
      delay: 0,
      ease: CUPERTINO_EASE
    };
    const cut = perceptualCutMs(fade, box, 2);
    expect(cut).not.toBeNull();
    expect(cut!).toBeGreaterThan(100);
    expect(cut!).toBeLessThan(295);
  });

  it("includes the delay in the cut time", () => {
    const withDelay = perceptualCutMs(slide({ delay: 0.1 }), box, 2)!;
    const without = perceptualCutMs(slide(), box, 2)!;
    expect(Math.round(withDelay - without)).toBe(100);
  });

  it("refuses channels it cannot reason about", () => {
    expect(perceptualCutMs(slide({ from: { scale: 0.9 }, to: { scale: 1 } }), box, 2)).toBeNull();
    expect(
      perceptualCutMs(slide({ from: { x: "calc(100% - 10px)" }, to: { x: 0 } }), box, 2)
    ).toBeNull();
    // One-sided channel: the counterpart is the property's current value,
    // which this analysis cannot see.
    expect(perceptualCutMs(slide({ from: { x: "100%" }, to: {} }), box, 2)).toBeNull();
  });

  it("parses px-unit channels", () => {
    const cut = perceptualCutMs(slide({ from: { x: "390px" }, to: { x: 0 } }), box, 2);
    expect(cut).not.toBeNull();
    expect(perceptualCutMs(slide({ from: { x: "px" }, to: { x: 0 } }), box, 2)).toBeNull();
  });

  it("refuses degenerate motions", () => {
    expect(perceptualCutMs(slide({ duration: 0 }), box, 2)).toBeNull();
    // Zero-distance channels only: nothing to measure against.
    expect(perceptualCutMs(slide({ from: { x: 0 }, to: { x: 0 } }), box, 2)).toBeNull();
    // Zero-width box: percentage distance collapses.
    expect(perceptualCutMs(slide(), { clientWidth: 0, clientHeight: 0 }, 2)).toBeNull();
  });

  it("skips the cut when it saves less than a frame's worth of clock", () => {
    // A linear ease exits the band only at the very end.
    expect(perceptualCutMs(slide({ ease: "linear", duration: 0.15 }), box, 2)).toBeNull();
  });

  it("survives overshooting eases by scanning from the end", () => {
    const cut = perceptualCutMs(slide({ ease: "backOut" }), box, 2);
    // backOut re-enters the band only after its overshoot returns; the cut
    // must sit after that, i.e. late in the motion, never inside the
    // overshoot.
    if (cut !== null) {
      expect(cut).toBeGreaterThan(300);
    }
  });
});
