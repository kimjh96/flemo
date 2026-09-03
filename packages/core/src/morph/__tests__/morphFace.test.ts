import { afterEach, describe, expect, it, vi } from "vitest";

import {
  faceGrids,
  faceHeight,
  faceHeightAt,
  faceParts,
  faceRatios,
  faceSteps
} from "@morph/morphFace";

// A FACE'S HEIGHT IS NOT A LINE.
//
// The half-leading a flight renders is `(line-height - the face's own height)`
// halved, and on Blink that second term climbs in whole-pixel steps while the
// first interpolates smoothly. Everything here exists so the line-height can be
// made to climb the same stairs, and so that an engine which does not have them
// is left alone.

const FAMILY = { family: "Test Sans", weight: 400, style: "normal" };

// A stand-in for the font: ascent and descent per em, rounded the way Blink
// rounds them, which is what makes the height a staircase.
const face = (ascent: number, descent: number) => {
  const context = {
    font: "",
    measureText: () => {
      const size = Number.parseFloat(context.font.split(" ").find((p) => p.endsWith("px")) ?? "0");
      return {
        fontBoundingBoxAscent: Math.round(size * ascent),
        fontBoundingBoxDescent: Math.round(size * descent)
      };
    }
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
  return context;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("faceRatios", () => {
  it("reads the face's ascent and descent per em", () => {
    face(0.952, 0.241);

    // Cache-busting through the weight: the ratios are remembered per face for
    // the session, which is what keeps a flight from paying for them twice.
    expect(faceRatios({ ...FAMILY, weight: 401 })).toEqual({ ascent: 0.952, descent: 0.241 });
  });

  it("asks at a size large enough for the answer to be precise", () => {
    // The metrics come back ROUNDED, so the ratio is only as good as the size
    // it was divided by. A boundary placed a hundredth of a pixel of font size
    // out was measured to be a whole frame wide at the end of a flight.
    const context = face(0.952, 0.241);
    faceRatios({ ...FAMILY, weight: 402 });

    const size = Number.parseFloat(context.font.split(" ").find((p) => p.endsWith("px")) ?? "0");
    expect(size).toBeGreaterThanOrEqual(1000);
  });

  it("refuses a probe the engine clamped", () => {
    // Ask for a size past the engine's ceiling and the metrics come back for
    // the size it actually used, which divided by the size asked for is a face
    // a fraction of an em tall. No real font is.
    face(0.0952, 0.0241);

    expect(faceRatios({ ...FAMILY, weight: 403 })).toBeNull();
  });

  it("keeps a face whose metrics cannot be read out of the way", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: () => ({})
    } as unknown as CanvasRenderingContext2D);

    expect(faceRatios({ ...FAMILY, weight: 404 })).toBeNull();
  });
});

describe("faceRatios, once", () => {
  it("remembers a face rather than measuring it again", () => {
    const context = face(0.95, 0.25);
    const font = { ...FAMILY, weight: 405 };

    faceRatios(font);
    const first = context.measureText.length;
    void first;
    const calls = (
      HTMLCanvasElement.prototype.getContext as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;
    faceRatios(font);

    expect(
      (HTMLCanvasElement.prototype.getContext as unknown as { mock: { calls: unknown[] } }).mock
        .calls.length
    ).toBe(calls);
  });

  it("stands aside where there is no drawing context at all", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    expect(faceRatios({ ...FAMILY, weight: 406 })).toBeNull();
    expect(faceHeight(20, { ...FAMILY, weight: 406 }, 1)).toBeNull();
  });

  it("refuses a face with no ascent to speak of", () => {
    face(0, 0.25);

    expect(faceRatios({ ...FAMILY, weight: 407 })).toBeNull();
  });

  it("refuses a face whose shorthand the host will not take", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      set font(_: string) {
        throw new Error("bad shorthand");
      },
      get font() {
        return "";
      },
      measureText: () => ({ fontBoundingBoxAscent: 1, fontBoundingBoxDescent: 1 })
    } as unknown as CanvasRenderingContext2D);

    expect(faceRatios({ ...FAMILY, weight: 408 })).toBeNull();
  });
});

describe("faceHeight", () => {
  it("reports what the line box will be built from, without laying anything out", () => {
    face(0.95, 0.25);

    expect(faceHeight(20, FAMILY, 1)).toBe(19 + 5);
  });

  it("declines a host that answers with no font box", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: () => ({ width: 10 })
    } as unknown as CanvasRenderingContext2D);

    expect(faceHeight(20, FAMILY, 1)).toBeNull();
  });

  it("gives the two halves apart, because the baseline sits on the ascent", () => {
    face(0.95, 0.25);

    expect(faceParts(20, FAMILY, 1)).toEqual({ ascent: 19, descent: 5 });
  });

  it("puts the answer on a finer grid by asking at a scaled size", () => {
    // The canvas rounds to ITS pixels, so a face measured at twice the size and
    // halved back is the same face rounded to half pixels — which is the grid a
    // 2x display's layout snaps to.
    face(0.9521, 0.2412);

    expect(faceHeight(14, FAMILY, 1)).toBe(13 + 3);
    expect(faceHeight(14, FAMILY, 2)).toBe(17);
    expect(faceHeight(14.5, FAMILY, 2)).toBe(17.5);
  });

  it("survives a font shorthand the host will not take", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      set font(_: string) {
        throw new Error("bad shorthand");
      },
      get font() {
        return "";
      },
      measureText: () => ({ fontBoundingBoxAscent: 1, fontBoundingBoxDescent: 1 })
    } as unknown as CanvasRenderingContext2D);

    expect(faceHeight(20, FAMILY, 1)).toBeNull();
  });
});

describe("faceSteps", () => {
  const ratios = { ascent: 0.95, descent: 0.25 };
  const parts = (size: number) => ({
    ascent: Math.round(size * 0.95),
    descent: Math.round(size * 0.25)
  });
  const height = (size: number) => parts(size).ascent + parts(size).descent;

  it("lands each step where the font actually takes it, not where arithmetic aimed", () => {
    const steps = faceSteps(14, 24, ratios, 1, parts);

    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      // The height on the far side is the one the stop carries, and a hair
      // before it the face is still shorter.
      expect(height(step.size)).toBe(step.parts.ascent + step.parts.descent);
      expect(height(step.size - 0.01)).toBeLessThan(step.parts.ascent + step.parts.descent);
    }
  });

  it("gives every step the flight passes through, in the order it meets them", () => {
    const steps = faceSteps(14, 24, ratios, 1, parts);
    const sizes = steps.map((s) => s.size);

    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(steps[0]!.parts.ascent + steps[0]!.parts.descent).toBe(height(steps[0]!.size));
    expect(steps[steps.length - 1]!.parts.ascent + steps[steps.length - 1]!.parts.descent).toBe(
      height(24)
    );
  });

  it("reads a shrinking flight backwards", () => {
    const sizes = faceSteps(24, 14, ratios, 1, parts).map((s) => s.size);

    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("counts a boundary once where both halves of the height step together", () => {
    // A face whose ascent and descent cross a half at the same size steps by
    // two, not twice: one stop carries the whole change.
    const both = { ascent: 0.5, descent: 0.5 };
    const steps = faceSteps(14, 24, both, 1, (size: number) => ({
      ascent: Math.round(size * 0.5),
      descent: Math.round(size * 0.5)
    }));

    expect(new Set(steps.map((s) => s.size)).size).toBe(steps.length);
  });

  it("ignores a half of the height that does not scale", () => {
    const steps = faceSteps(14, 24, { ascent: 0.95, descent: 0 }, 1, (size: number) => ({
      ascent: Math.round(size * 0.95),
      descent: 0
    }));

    expect(steps.length).toBeGreaterThan(0);
  });

  it("finds nothing where the face never changes height", () => {
    expect(faceSteps(14, 24, ratios, 1, () => ({ ascent: 15, descent: 5 }))).toEqual([]);
  });

  it("declines a face it cannot measure rather than guessing", () => {
    expect(faceSteps(14, 24, ratios, 1, () => null)).toEqual([]);
  });
});

describe("faceHeightAt", () => {
  it("snaps each half of the height, which is what makes it a staircase", () => {
    // 20 * 0.952 = 19.04 and 20 * 0.241 = 4.82: nineteen and five, not 23.86.
    expect(faceHeightAt(20, { ascent: 0.952, descent: 0.241 }, 1)).toBe(24);
  });

  it("snaps to the grid it is given, not to whole pixels", () => {
    expect(faceHeightAt(14, { ascent: 0.9521, descent: 0.2412 }, 2)).toBe(17);
  });
});

describe("faceGrids", () => {
  it("offers whole pixels, and device pixels where they are finer", () => {
    expect(faceGrids()).toEqual([1]);

    const ratio = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    try {
      expect(faceGrids()).toEqual([1, 2]);
    } finally {
      if (ratio) Object.defineProperty(window, "devicePixelRatio", ratio);
    }
  });
});
