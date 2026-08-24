import { describe, expect, it } from "vitest";

import { untransformedCentre, untransformRect, type MorphRect } from "@morph/morphGeometry";

const rect = (x: number, y: number, width: number, height: number): MorphRect => ({
  x,
  y,
  width,
  height
});

describe("untransformRect", () => {
  it("undoes a screen that is held one width off-stage", () => {
    // The arriving screen sits at its from-pose while the flight is held, so
    // everything measured inside it is a screen-width to the right.
    const screenPose = { x: 400, y: 0, scaleX: 1, scaleY: 1, rotate: 0 };
    const screenCentre = untransformedCentre(rect(400, 0, 400, 800), screenPose);
    expect(screenCentre).toEqual({ x: 200, y: 400 });

    expect(untransformRect(rect(440, 100, 200, 150), screenPose, screenCentre)).toEqual(
      rect(40, 100, 200, 150)
    );
  });

  it("undoes a scaled screen about the screen's own centre", () => {
    const screenPose = { x: 0, y: 0, scaleX: 0.5, scaleY: 0.5, rotate: 0 };
    const screenCentre = { x: 200, y: 400 };
    // A box that would be 100x100 at (150, 350) is painted half-size, pulled
    // toward the screen's centre.
    const painted = rect(175, 375, 50, 50);
    const restored = untransformRect(painted, screenPose, screenCentre);
    expect(restored.width).toBe(100);
    expect(restored.height).toBe(100);
    expect(restored.x).toBeCloseTo(150, 6);
    expect(restored.y).toBeCloseTo(350, 6);
  });
});
