import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveEasing } from "@transition/cubicBezier";

import { captureMorphSnapshot, isSingleLine } from "@morph/morphGeometry";
import {
  holdOneLine,
  holdsOneLine,
  leadingBias,
  leadingStops,
  LINE_HOLD,
  trackStops
} from "@morph/morphLine";

const setRect = (element: HTMLElement, width: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      toJSON: () => ({})
    }) as DOMRect;
};

const stubStyles = (styles: Record<string, string>) => {
  vi.stubGlobal("getComputedStyle", () => styles);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSingleLine", () => {
  it("reads a line off the leading where there is one", () => {
    expect(isSingleLine(16, 16, 11)).toBe(true);
    // Room for the padding an author may have put around the line.
    expect(isSingleLine(24, 16, 11)).toBe(true);
    // Two lines are 2x a line, which the tolerance does not reach.
    expect(isSingleLine(32, 16, 11)).toBe(false);
  });

  it("falls back to the type's own size where the leading is a keyword", () => {
    // `line-height: normal` is font-defined, so there is no length to read;
    // a line is then about 1.35x the size, and two of them 2.7x.
    expect(isSingleLine(13, null, 11)).toBe(true);
    expect(isSingleLine(30, null, 11)).toBe(false);
  });

  it("declines what it cannot measure", () => {
    expect(isSingleLine(0, 16, 11)).toBe(false);
    expect(isSingleLine(16, null, null)).toBe(false);
    expect(isSingleLine(16, 0, null)).toBe(false);
  });
});

describe("captureMorphSnapshot().singleLine", () => {
  it("is true for one line of text", () => {
    stubStyles({ fontSize: "11px", lineHeight: "16px" });
    const element = document.createElement("span");
    element.textContent = "Thu 20:00 · 35,000";
    setRect(element, 119, 16);

    expect(captureMorphSnapshot(element).singleLine).toBe(true);
  });

  it("is false for two", () => {
    stubStyles({ fontSize: "11px", lineHeight: "16px" });
    const element = document.createElement("span");
    element.textContent = "Thu 20:00 · 35,000";
    setRect(element, 119, 32);

    expect(captureMorphSnapshot(element).singleLine).toBe(false);
  });

  it("is false for a box that merely happens to be short", () => {
    // A row with children is not a line, and the hold this answers for clips —
    // so an element with element children never takes it, whatever its height.
    stubStyles({ fontSize: "11px", lineHeight: "16px" });
    const element = document.createElement("div");
    element.appendChild(document.createElement("img"));
    setRect(element, 119, 16);

    expect(captureMorphSnapshot(element).singleLine).toBe(false);
  });
});

describe("holdsOneLine", () => {
  it("needs both ends", () => {
    expect(holdsOneLine(true, true)).toBe(true);
    // One end wrapping is a journey that has an honest reason for two lines.
    expect(holdsOneLine(true, false)).toBe(false);
    expect(holdsOneLine(false, true)).toBe(false);
    expect(holdsOneLine(false, false)).toBe(false);
  });
});

describe("holdOneLine", () => {
  it("writes the departure's own appearance, as inline style", () => {
    // Inline, because the landing restores the element's whole style attribute
    // — the hold needs no undo of its own.
    const element = document.createElement("span");
    holdOneLine(element);

    expect(element.style.whiteSpace).toBe(LINE_HOLD.whiteSpace);
    expect(element.style.overflow).toBe(LINE_HOLD.overflow);
    expect(element.style.textOverflow).toBe(LINE_HOLD.textOverflow);
  });
});

// Both engines render the half-leading — `(line-height - the face's own
// height) / 2` — floored to whole pixels, so a flight that interpolates the
// leading steps once per pixel boundary it crosses. At the end that step is the
// whole artefact: an interpolation only holds its endpoint from the instant the
// flight ends, which is the instant the flight lands, so a pair whose arrival
// half-leading sits ON a boundary renders the entire flight one floor down and
// the landing puts it back.

// Both engines put a line on a grid and floor the half-leading to it, but they
// do not agree on the grid: iOS Safari uses whole CSS pixels, desktop Chrome
// uses DEVICE pixels. Either way an interpolation only holds its endpoint from
// the instant the flight lands, so a pair whose arrival half-leading sits ON a
// step renders the whole flight one step down and the landing puts it back.
describe("leadingBias", () => {
  const dpr = (ratio: number | undefined) => {
    if (ratio === undefined) {
      Reflect.deleteProperty(window, "devicePixelRatio");
      return;
    }
    Object.defineProperty(window, "devicePixelRatio", { value: ratio, configurable: true });
  };

  afterEach(() => dpr(1));

  describe("on a whole-pixel grid (iOS Safari)", () => {
    // The device's own numbers: 11px type in a 16px line box handing over to
    // 14px in 20px. Both half-leadings are exactly 1.0, and exactly 1.0 is what
    // an interpolation can only approach.
    const cell = { lineHeight: 16, textHeight: 14, leadOffset: 1 };
    const page = { lineHeight: 20, textHeight: 18, leadOffset: 1 };

    it("sits the travel in the middle of its step", () => {
      dpr(3);
      expect(leadingBias(cell, page)).toBe(1);
    });

    it("renders the flight and the landing on the same step", () => {
      dpr(3);
      const bias = leadingBias(cell, page);
      const half = (line: number, text: number) => Math.floor((line - text) / 2);

      expect(half(page.lineHeight, page.textHeight)).toBe(1);
      expect(half(cell.lineHeight + bias, cell.textHeight)).toBe(1);
      // Including the frame a hair short of the end, which used to be a step up.
      expect(half(page.lineHeight + bias - 0.001, page.textHeight)).toBe(1);
    });
  });

  describe("on a device-pixel grid (desktop Chrome at 2x)", () => {
    // Reported from a real window: `lead: 1.500`, which no whole-pixel rule can
    // produce. Both the heading and the line under it sit on the same half-pixel
    // step, which is why both of them stepped and the card between them did not.
    const cell = { lineHeight: 20, textHeight: 17, leadOffset: 1.5 };
    const page = { lineHeight: 32, textHeight: 29, leadOffset: 1.5 };

    it("finds the finer grid and centres on it", () => {
      dpr(2);
      expect(leadingBias(cell, page)).toBeCloseTo(0.5, 6);
    });

    it("renders the flight and the landing on the same step", () => {
      dpr(2);
      const bias = leadingBias(cell, page);
      const half = (line: number, text: number) => Math.floor((line - text) / 2 / 0.5 + 1e-6) * 0.5;

      expect(half(page.lineHeight, page.textHeight)).toBe(1.5);
      expect(half(page.lineHeight + bias, page.textHeight)).toBe(1.5);
      expect(half(page.lineHeight + bias - 0.001, page.textHeight)).toBe(1.5);
    });

    it("would have stood down without the finer grid", () => {
      // The whole-pixel rule cannot reproduce a rendered 1.5, so before the grid
      // was measured rather than assumed this pair kept its step.
      dpr(1);
      expect(leadingBias(cell, page)).toBe(0);
    });
  });

  it("leaves a pair that is already clear of a step alone", () => {
    dpr(3);
    expect(
      leadingBias(
        { lineHeight: 20, textHeight: 17, leadOffset: 1 },
        { lineHeight: 32, textHeight: 29, leadOffset: 1 }
      )
    ).toBe(0);
  });

  it("declines a travel wider than one step", () => {
    dpr(3);
    expect(
      leadingBias(
        { lineHeight: 24, textHeight: 14, leadOffset: 5 },
        { lineHeight: 20, textHeight: 18, leadOffset: 1 }
      )
    ).toBe(0);
  });

  it("stands down where no grid reproduces what the engine rendered", () => {
    // Moving type on a misread rule is worse than the step it was chasing.
    dpr(2);
    expect(
      leadingBias(
        { lineHeight: 16, textHeight: 14, leadOffset: 1 },
        { lineHeight: 20, textHeight: 18, leadOffset: 0.75 }
      )
    ).toBe(0);
  });

  it("falls back to whole pixels where the host reports no ratio", () => {
    // A grid finer than a CSS pixel needs a ratio to derive it from.
    dpr(undefined);
    const cell = { lineHeight: 16, textHeight: 14, leadOffset: 1 };
    const page = { lineHeight: 20, textHeight: 18, leadOffset: 1 };
    expect(leadingBias(cell, page)).toBe(1);

    dpr(0);
    expect(leadingBias(cell, page)).toBe(1);
  });

  it("declines an end it cannot measure", () => {
    dpr(3);
    const cell = { lineHeight: 16, textHeight: 14, leadOffset: 1 };
    const page = { lineHeight: 20, textHeight: 18, leadOffset: 1 };
    expect(leadingBias({ ...cell, lineHeight: null }, page)).toBe(0);
    expect(leadingBias({ ...cell, textHeight: null }, page)).toBe(0);
    expect(leadingBias(cell, { ...page, leadOffset: null })).toBe(0);
  });
});

// The face's own metrics come off ONE range rect: its height is the type's, its
// top against the box's is where the engine put the line. jsdom gives a range no
// rects at all, so the rect is supplied here and what is under test is the
// bookkeeping around it: the per-face cache, and the two refusals.
describe("captureMorphSnapshot type metrics", () => {
  const runRect = (top: number, height: number) =>
    ({ top, height, left: 0, right: 0, bottom: top + height, width: 0, x: 0, y: top }) as DOMRect;

  const stubRange = (rects: () => DOMRect[]) => {
    const create = vi.spyOn(document, "createRange").mockImplementation(
      () =>
        ({
          selectNodeContents: () => {},
          getClientRects: () => rects() as unknown as DOMRectList
        }) as unknown as Range
    );
    return create;
  };

  const line = (family: string, height: number) => {
    const element = document.createElement("span");
    element.textContent = "Thu 20:00";
    setRect(element, 119, height);
    Object.defineProperty(element, "offsetHeight", { value: height, configurable: true });
    stubStyles({
      fontSize: "14px",
      fontWeight: "400",
      fontStyle: "normal",
      fontFamily: family,
      lineHeight: "20px"
    });
    return element;
  };

  it("reads the face's height and the rendered line offset from one rect", () => {
    stubRange(() => [runRect(2, 17)]);
    const snapshot = captureMorphSnapshot(line("Probe One", 20));

    expect(snapshot.textHeight).toBe(17);
    expect(snapshot.leadOffset).toBe(2);
  });

  it("measures once per type style, not once per element", () => {
    // A navigation captures every registered morph, and a range measurement is
    // a forced layout each. The face's height belongs to the face.
    const create = stubRange(() => [runRect(1.5, 16)]);
    captureMorphSnapshot(line("Probe Two", 20));
    const after = create.mock.calls.length;
    captureMorphSnapshot(line("Probe Two", 20));
    captureMorphSnapshot(line("Probe Two", 20));

    expect(create.mock.calls.length).toBe(after);
  });

  it("refuses a measurement taken through an ancestor's scale", () => {
    // A range's rects are painted, so a scale is baked into them while the size
    // the cache is keyed on is not.
    stubRange(() => [runRect(2, 17)]);
    const element = line("Probe Three", 20);
    Object.defineProperty(element, "offsetHeight", { value: 40, configurable: true });

    expect(captureMorphSnapshot(element).textHeight).toBeNull();
  });

  it("refuses a run with no rects, and one with no height", () => {
    stubRange(() => []);
    expect(captureMorphSnapshot(line("Probe Four", 20)).textHeight).toBeNull();
    stubRange(() => [runRect(0, 0)]);
    expect(captureMorphSnapshot(line("Probe Five", 20)).textHeight).toBeNull();
  });

  it("declines a host whose ranges have no rects at all", () => {
    // jsdom, and anything else that lays nothing out.
    vi.spyOn(document, "createRange").mockImplementation(
      () => ({ selectNodeContents: () => {} }) as unknown as Range
    );
    expect(captureMorphSnapshot(line("Probe Six", 20)).textHeight).toBeNull();
  });

  it("keys on the font loader's status, so a fallback face is not kept for the webfont", () => {
    // The same declaration measures differently before and after the webfont
    // lands, and the cache must not carry the first answer into the second.
    Object.defineProperty(document, "fonts", {
      value: { status: "loading" },
      configurable: true
    });
    stubRange(() => [runRect(2, 15)]);
    expect(captureMorphSnapshot(line("Probe Eight", 20)).textHeight).toBe(15);

    Object.defineProperty(document, "fonts", {
      value: { status: "loaded" },
      configurable: true
    });
    stubRange(() => [runRect(2, 17)]);
    expect(captureMorphSnapshot(line("Probe Eight", 20)).textHeight).toBe(17);

    Reflect.deleteProperty(document, "fonts");
  });

  it("declines anything that is not one run of text", () => {
    stubRange(() => [runRect(2, 17)]);
    const withChild = line("Probe Seven", 20);
    withChild.textContent = "";
    withChild.appendChild(document.createElement("b"));

    expect(captureMorphSnapshot(withChild).textHeight).toBeNull();
  });
});

// A LINE-HEIGHT THAT CLIMBS THE SAME STAIRS THE FACE DOES.
//
// The bias above puts the two ENDS of a flight inside one step of the grid.
// Between them the half-leading is a smooth line minus a staircase, which is a
// sawtooth, and on Blink it crosses the grid several times per flight. Device
// numbers, desktop Chrome, the playground's title: `2 -> 1.5 -> 1 -> 1.5` in one
// flight, and the last of those is what reads as the type being nudged down a
// moment after it lands.
describe("leadingStops", () => {
  const FONT = { family: "Test Sans", weight: 800, style: "normal" };
  // A face that rounds each half of its height, the way Blink's does.
  const stub = (ascent: number, descent: number) => {
    const context = {
      font: "",
      measureText: () => {
        const size = Number.parseFloat(
          context.font.split(" ").find((part) => part.endsWith("px")) ?? "0"
        );
        return {
          fontBoundingBoxAscent: Math.round(size * ascent),
          fontBoundingBoxDescent: Math.round(size * descent)
        };
      }
    };
    return vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  };
  const height = (size: number, a = 0.95, d = 0.25) => Math.round(size * a) + Math.round(size * d);
  const end = (fontSize: number, lineHeight: number, a = 0.95, d = 0.25) => ({
    fontSize,
    lineHeight,
    textHeight: height(fontSize, a, d)
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("holds the leading at the arrival's own value for the whole flight", () => {
    stub(0.95, 0.25);
    const from = end(14, 20);
    const to = end(24, 32);

    const stops = leadingStops(from, to, { ...FONT, family: "Hold Sans" }, undefined)!;

    expect(stops).not.toBeNull();
    const leading = to.lineHeight - to.textHeight;
    for (const stop of stops) {
      // Every stop is a face height the flight passes through plus one fixed
      // leading, which is what makes the rendered half-leading a constant.
      const face = stop.lineHeight - leading;
      expect(face).toBe(Math.round(face));
      expect(face).toBeGreaterThanOrEqual(height(14));
      expect(face).toBeLessThanOrEqual(height(24));
    }
    // And they climb, one step at a time, exactly as the face does.
    expect(stops.map((s) => s.lineHeight)).toEqual(
      [...stops.map((s) => s.lineHeight)].sort((a, b) => a - b)
    );
  });

  it("lands on the arrival's authored line-height, so the landing is exact", () => {
    stub(0.95, 0.25);

    const stops = leadingStops(
      end(14, 20),
      end(24, 32),
      { ...FONT, family: "Land Sans" },
      undefined
    )!;

    const last = stops[stops.length - 1]!;
    expect(last.at).toBe(100);
    expect(last.lineHeight).toBe(32);
  });

  it("stands down where the face height does not step", () => {
    // An engine that reports a continuous face height has no staircase to
    // climb, and its leading already holds still. This is what stands in for a
    // browser check: the prediction simply fails to reproduce the ends.
    stub(0.95, 0.25);
    const smooth = (fontSize: number, lineHeight: number) => ({
      fontSize,
      lineHeight,
      textHeight: fontSize * 1.2
    });

    expect(
      leadingStops(smooth(14, 20), smooth(24, 32), { ...FONT, family: "Smooth Sans" }, undefined)
    ).toBeNull();
  });

  it("stands down for type that does not change size", () => {
    stub(0.95, 0.25);

    expect(
      leadingStops(end(24, 32), end(24, 34), { ...FONT, family: "Same Sans" }, undefined)
    ).toBeNull();
  });

  it("stands down where an end was never measured, and where there is no face", () => {
    stub(0.95, 0.25);

    expect(
      leadingStops(
        { fontSize: null, lineHeight: 20, textHeight: 17 },
        end(24, 32),
        { ...FONT, family: "Partial Sans" },
        undefined
      )
    ).toBeNull();
    expect(
      leadingStops(
        { fontSize: 14, lineHeight: null, textHeight: 17 },
        end(24, 32),
        { ...FONT, family: "Partial Sans" },
        undefined
      )
    ).toBeNull();
    expect(
      leadingStops(
        { fontSize: 14, lineHeight: 20, textHeight: null },
        end(24, 32),
        { ...FONT, family: "Partial Sans" },
        undefined
      )
    ).toBeNull();
    expect(leadingStops(end(14, 20), end(24, 32), null, undefined)).toBeNull();
  });

  it("places each stop at the TIME the ease reaches it, not at its share of the range", () => {
    // Font size travels with the eased progress, so a step two-thirds of the
    // way through the sizes is met long before two-thirds of the flight under
    // a curve that opens fast.
    stub(0.95, 0.25);

    const eased = leadingStops(
      end(14, 20),
      end(24, 32),
      { ...FONT, family: "Eased Sans" },
      [0.32, 0.72, 0, 1]
    )!;
    const linear = leadingStops(
      end(14, 20),
      end(24, 32),
      { ...FONT, family: "Linear Sans" },
      [0, 0, 1, 1]
    )!;

    expect(eased.length).toBe(linear.length);
    // The same stops, met earlier: an ease that front-loads its travel reaches
    // every size sooner than a straight line does.
    expect(eased[1]!.at).toBeLessThan(linear[1]!.at);
  });

  it("stands down where the face steps nowhere inside the flight", () => {
    // Both ends reproduce, so the engine is one that quantises — but a range
    // this narrow crosses no boundary, and a staircase with no stairs is just
    // the line-height the flight already had.
    stub(0.95, 0.25);

    expect(
      leadingStops(end(20.2, 27), end(20.4, 27.2), { ...FONT, family: "Narrow Sans" }, undefined)
    ).toBeNull();
  });

  it("drops a step that falls outside the flight's own window", () => {
    // A boundary the ease reaches only at the very ends is already carried by
    // the stops that bracket it.
    stub(0.95, 0.25);
    const stops = leadingStops(
      end(14, 20),
      end(24, 32),
      { ...FONT, family: "Edge Sans" },
      undefined
    )!;

    for (const stop of stops.slice(1, -1)) {
      expect(stop.at).toBeGreaterThan(0);
      expect(stop.at).toBeLessThan(100);
    }
  });

  it("stands down where the ends' own metrics cannot be had", () => {
    // The stops carry the ascent as well as the height, and a face that will
    // not give one has nothing for the box to cancel.
    const context = {
      font: "",
      measureText: () => ({ fontBoundingBoxAscent: 9521, fontBoundingBoxDescent: 2412 })
    };
    let asked = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      asked += 1;
      // The ratios come off the first call; every size after it answers with
      // nothing, which is a host that measured once and then could not.
      return (asked <= 1
        ? context
        : { font: "", measureText: () => ({}) }) as unknown as CanvasRenderingContext2D;
    });

    expect(
      leadingStops(end(14, 20), end(24, 32), { ...FONT, family: "Gone Sans" }, undefined)
    ).toBeNull();
  });

  it("finds a step even where the aims crowd together", () => {
    // An ease that opens fast packs several steps into a hundredth of the
    // flight. Searching each aim in a window of its own size swallowed the ones
    // after the first; each is searched between its NEIGHBOURS instead.
    stub(0.95, 0.25);
    const stops = leadingStops(
      end(14, 20),
      end(24, 32),
      { ...FONT, family: "Crowd Sans" },
      [0.32, 0.72, 0, 1]
    )!;

    expect(stops.length).toBeGreaterThan(4);
    // Every stop is its own moment, in order, and the heights only ever climb.
    for (let i = 1; i < stops.length; i += 1) {
      expect(stops[i]!.at).toBeGreaterThan(stops[i - 1]!.at);
      expect(stops[i]!.lineHeight).toBeGreaterThanOrEqual(stops[i - 1]!.lineHeight);
    }
  });

  it("keeps a step the flight never reaches out of the stops", () => {
    // A face whose height is settled before the flight begins has nothing to
    // find, and an aim with no change inside its bracket is dropped.
    stub(0.95, 0.25);
    const flat = (fontSize: number, lineHeight: number) => ({
      fontSize,
      lineHeight,
      textHeight: Math.round(fontSize * 0.95) + Math.round(fontSize * 0.25)
    });

    expect(
      leadingStops(flat(20.1, 27), flat(20.2, 27.1), { ...FONT, family: "Still Sans" }, undefined)
    ).toBeNull();
  });

  it("counts a step once where both halves of the face cross together", () => {
    // Two aims land on one real boundary, so the second finds nothing left in
    // its bracket: the first has already carried the change and the search
    // starts after it.
    stub(0.5, 0.5);
    const both = (fontSize: number, lineHeight: number) => ({
      fontSize,
      lineHeight,
      textHeight: Math.round(fontSize * 0.5) * 2
    });
    const stops = leadingStops(
      both(14, 20),
      both(24, 32),
      { ...FONT, family: "Twin Sans" },
      undefined
    )!;

    expect(stops).not.toBeNull();
    for (let i = 1; i < stops.length; i += 1) {
      expect(stops[i]!.at).toBeGreaterThan(stops[i - 1]!.at);
    }
    // One stop per real change, not two: a face that steps by two at once
    // gets one stop carrying the whole change.
    const interior = stops.slice(1, -1).map((stop) => stop.lineHeight);
    expect(new Set(interior).size).toBe(interior.length);
  });

  it("remembers a pair's stairs rather than bisecting them twice", () => {
    const context = stub(0.95, 0.25);
    const args = [end(14, 20), end(24, 32), { ...FONT, family: "Cached Sans" }, undefined] as const;

    leadingStops(...args);
    const first = context.mock.calls.length;
    leadingStops(...args);

    expect(context.mock.calls.length).toBe(first);
  });
});

// A RUN THAT DOES NOT DRIFT APART.
//
// Only the correction's SHAPE is testable without a real face: that it reads
// one width per size, aims at the straight line between the two ends, and
// spreads what it finds over the gaps. Which faces actually need it is a
// property of the face, measured on glass.
describe("trackStops", () => {
  const FONT = { family: "Test Sans", weight: 800, style: "normal" };
  const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
  const TEXT = "Aria Wave";
  const GAPS = [...TEXT].length - 1;

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
  };

  it("declines where there is no face to ask, no travel, or no gap to spread over", () => {
    advances((size) => size * 4);

    expect(trackStops(TEXT, { fontSize: 14 }, { fontSize: 24 }, null, EASE)).toBeNull();
    expect(trackStops(TEXT, { fontSize: 14 }, { fontSize: 14 }, FONT, EASE)).toBeNull();
    expect(trackStops(TEXT, { fontSize: null }, { fontSize: 24 }, FONT, EASE)).toBeNull();
    // One glyph has no gap, so there is nowhere to put a correction.
    expect(trackStops("A", { fontSize: 14 }, { fontSize: 24 }, FONT, EASE)).toBeNull();
  });

  it("finds nothing to cancel on a face whose advances track their size", () => {
    advances((size) => size * 4);

    const stops = trackStops(TEXT, { fontSize: 14 }, { fontSize: 25 }, FONT, EASE)!;

    expect(stops).not.toBeNull();
    for (const stop of stops) expect(stop.fix).toBeCloseTo(0, 6);
  });

  it("spreads the run's whole deviation from the line over its gaps", () => {
    // A face that bows off the line in the middle and meets it at both ends,
    // which is the shape an optically sized face actually draws.
    const width = (size: number) => size * 4 + (size - 14) * (26 - size) * 0.02;
    advances(width);

    const stops = trackStops(TEXT, { fontSize: 14 }, { fontSize: 26 }, FONT, EASE)!;
    const curve = resolveEasing(EASE);

    for (const [index, stop] of stops.entries()) {
      const part = index / (stops.length - 1);
      const size = 14 + 12 * part;
      // What the run measures here, plus the correction spread back over its
      // gaps, is the width the straight line asked for.
      expect(width(size) + stop.fix * GAPS).toBeCloseTo(
        width(14) + (width(26) - width(14)) * part,
        6
      );
      // And the stop sits at the time the flight reaches that size.
      expect(curve(stop.at / 100)).toBeCloseTo(part, 4);
    }
    // Both ends measure themselves, so the landing is untouched.
    expect(stops[0].fix).toBeCloseTo(0, 6);
    expect(stops[stops.length - 1].fix).toBeCloseTo(0, 6);
    // The middle is off the line, so there is something to carry there.
    expect(Math.abs(stops[Math.floor(stops.length / 2)].fix)).toBeGreaterThan(0.01);
  });

  it("asks a face for a run once and remembers what it said", () => {
    let asked = 0;
    advances((size) => {
      asked += 1;
      return size * 4;
    });

    const first = trackStops(TEXT, { fontSize: 12 }, { fontSize: 28 }, FONT, EASE);
    const measured = asked;
    const again = trackStops(TEXT, { fontSize: 12 }, { fontSize: 28 }, FONT, EASE);

    expect(again).toBe(first);
    expect(asked).toBe(measured);
    // A flight with no authored easing is a different question, not the same
    // answer under a different name.
    expect(trackStops(TEXT, { fontSize: 12 }, { fontSize: 28 }, FONT, undefined)).not.toBe(first);
    expect(asked).toBeGreaterThan(measured);
  });

  it("keeps its stops in order and inside the flight", () => {
    advances((size) => size * 4 + Math.sin(size) * 0.1);

    const stops = trackStops(TEXT, { fontSize: 13 }, { fontSize: 27 }, FONT, EASE)!;

    expect(stops[0].at).toBe(0);
    expect(stops[stops.length - 1].at).toBe(100);
    for (let i = 1; i < stops.length; i += 1) expect(stops[i].at).toBeGreaterThan(stops[i - 1].at);
  });
});
