import { afterEach, describe, expect, it, vi } from "vitest";

import { captureMorphSnapshot, isSingleLine } from "@morph/morphGeometry";
import { holdOneLine, holdsOneLine, leadingBias, LINE_HOLD } from "@morph/morphLine";

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

  it("declines an end it cannot measure", () => {
    dpr(3);
    const cell = { lineHeight: 16, textHeight: 14, leadOffset: 1 };
    const page = { lineHeight: 20, textHeight: 18, leadOffset: 1 };
    expect(leadingBias({ ...cell, lineHeight: null }, page)).toBe(0);
    expect(leadingBias({ ...cell, textHeight: null }, page)).toBe(0);
    expect(leadingBias(cell, { ...page, leadOffset: null })).toBe(0);
  });
});
