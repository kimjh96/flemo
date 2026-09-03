import { afterEach, describe, expect, it, vi } from "vitest";

import {
  faceAims,
  faceGrids,
  faceHeight,
  faceHeightAt,
  faceParts,
  faceRatios,
  runAdvance,
  sameFace
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

describe("faceAims", () => {
  const ratios = { ascent: 0.95, descent: 0.25 };

  it("names every size at which a half of the height could cross the grid", () => {
    const aims = faceAims(14, 24, ratios, 1);

    expect(aims.length).toBeGreaterThan(0);
    for (const aim of aims) {
      expect(aim).toBeGreaterThan(14);
      expect(aim).toBeLessThanOrEqual(24);
      // Halfway between two points of the grid, for one half or the other.
      const onAscent = Math.abs(((aim * 0.95) % 1) - 0.5) < 1e-6;
      const onDescent = Math.abs(((aim * 0.25) % 1) - 0.5) < 1e-6;
      expect(onAscent || onDescent).toBe(true);
    }
  });

  it("gives them in the order the flight meets them", () => {
    expect(faceAims(14, 24, ratios, 1)).toEqual(
      [...faceAims(14, 24, ratios, 1)].sort((a, b) => a - b)
    );
    const back = faceAims(24, 14, ratios, 1);
    expect(back).toEqual([...back].sort((a, b) => b - a));
  });

  it("aims on the grid it is given", () => {
    // A finer grid has more places to cross, so a display that snaps to half
    // pixels meets twice as many steps as one that snaps to whole ones.
    expect(faceAims(14, 24, ratios, 2).length).toBeGreaterThan(faceAims(14, 24, ratios, 1).length);
  });

  it("ignores a half of the height that does not scale", () => {
    expect(faceAims(14, 24, { ascent: 0.95, descent: 0 }, 1).length).toBeGreaterThan(0);
  });
});

describe("sameFace", () => {
  it("compares both halves, since the baseline rides only one of them", () => {
    expect(sameFace({ ascent: 19, descent: 5 }, { ascent: 19, descent: 5 })).toBe(true);
    // Same height, different halves: the line box is the same and the baseline
    // is not.
    expect(sameFace({ ascent: 19, descent: 5 }, { ascent: 18, descent: 6 })).toBe(false);
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

describe("runAdvance", () => {
  // The width of a whole run, which is the quantity the tracking correction is
  // built against: one number per size, not one per glyph.
  const advances = (widthFor: (size: number) => number) => {
    const context = {
      font: "",
      measureText: () => ({
        width: widthFor(
          Number.parseFloat(context.font.split(" ").find((p) => p.endsWith("px")) ?? "0")
        )
      })
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    return context;
  };

  it("asks the face for the run at the size given", () => {
    const context = advances((size) => size * 4);

    expect(runAdvance("Aria Wave", 14, FAMILY)).toBe(56);
    expect(context.font).toBe("normal 400 14px Test Sans");
  });

  it("declines a host with no canvas to ask", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    expect(runAdvance("Aria Wave", 14, FAMILY)).toBeNull();
  });

  it("declines a width that is not one", () => {
    advances(() => 0);

    expect(runAdvance("Aria Wave", 14, FAMILY)).toBeNull();
  });

  it("declines a face whose name the shorthand will not take", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      set font(_value: string) {
        throw new SyntaxError("bad shorthand");
      },
      measureText: () => ({ width: 10 })
    } as unknown as CanvasRenderingContext2D);

    expect(runAdvance("Aria Wave", 14, FAMILY)).toBeNull();
  });
});
