import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureMorphSnapshot,
  followPose,
  readElementPose,
  untransformedCentre,
  untransformRect,
  type MorphRect
} from "@morph/morphGeometry";

const rect = (x: number, y: number, width: number, height: number): MorphRect => ({
  x,
  y,
  width,
  height
});

// Every channel a snapshot reads, controlled exactly. jsdom resolves only some
// of them, and what is under test is which values the runtime accepts as
// animatable — not what jsdom happens to compute.
const stubStyles = (styles: Record<string, string>) => {
  vi.stubGlobal("getComputedStyle", () => styles);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("untransformRect", () => {
  it("refuses to divide a rect by a zero scale", () => {
    // A screen held at `scale: 0` is a legal authored pose, and dividing by it
    // sends the flight to infinity.
    const collapsed = { x: 0, y: 0, scaleX: 0, scaleY: 0, rotate: 0 };
    expect(untransformRect(rect(10, 20, 30, 40), collapsed, { x: 0, y: 0 })).toEqual(
      rect(10, 20, 30, 40)
    );
  });

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

describe("captureMorphSnapshot", () => {
  it("reads the type channels a morph can interpolate", () => {
    stubStyles({
      fontSize: "14px",
      fontWeight: "600",
      letterSpacing: "0.5px",
      wordSpacing: "2px",
      lineHeight: "20px",
      aspectRatio: "3 / 2",
      paddingTop: "1px",
      paddingRight: "2px",
      paddingBottom: "3px",
      paddingLeft: "4px",
      marginTop: "0px",
      marginRight: "0px",
      marginBottom: "0px",
      marginLeft: "0px",
      borderRadius: "8px"
    });

    const snapshot = captureMorphSnapshot(document.createElement("div"));

    expect(snapshot).toMatchObject({
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: 0.5,
      wordSpacing: 2,
      lineHeight: 20,
      aspectRatio: "3 / 2",
      padding: "1px 2px 3px 4px"
    });
    expect(snapshot.paint["border-radius"]).toBe("8px");
  });

  it("declines the font-defined keywords rather than guessing a length", () => {
    // `normal` leading and tracking are computed from the face, not from a
    // number, so there is no midpoint between one end's keyword and the other
    // end's px. Those elements keep what they were authored with.
    stubStyles({
      fontSize: "16px",
      fontWeight: "400",
      letterSpacing: "normal",
      wordSpacing: "normal",
      lineHeight: "normal",
      aspectRatio: "auto"
    });

    expect(captureMorphSnapshot(document.createElement("div"))).toMatchObject({
      letterSpacing: null,
      wordSpacing: null,
      lineHeight: null,
      aspectRatio: null
    });
  });

  it("declines a px value whose number is not a number", () => {
    // `..px` matches the shape and parses to NaN. A NaN in a keyframe is a
    // dropped declaration at best.
    stubStyles({ letterSpacing: "..px" });
    expect(captureMorphSnapshot(document.createElement("div")).letterSpacing).toBeNull();
  });

  it("declines a length that is not a single px value", () => {
    stubStyles({ fontSize: "inherit", fontWeight: "bold", letterSpacing: "calc(1px + 1%)" });

    expect(captureMorphSnapshot(document.createElement("div"))).toMatchObject({
      fontSize: null,
      fontWeight: null,
      letterSpacing: null
    });
  });

  it("still returns a snapshot where computed styles are unavailable", () => {
    // The rect is the one thing a flight cannot do without; everything else
    // degrades to "do not animate this channel".
    vi.stubGlobal("getComputedStyle", undefined);

    expect(captureMorphSnapshot(document.createElement("div"))).toMatchObject({
      fontSize: null,
      fontWeight: null,
      letterSpacing: null,
      aspectRatio: null,
      padding: "0px 0px 0px 0px",
      margin: "0px 0px 0px 0px",
      paint: {}
    });
  });
});

describe("readElementPose", () => {
  it("reads the translate forms a screen transition writes", () => {
    stubStyles({ transform: "translate3d(-40px, 12px, 0)" });
    expect(readElementPose(document.createElement("div"))).toMatchObject({ x: -40, y: 12 });

    stubStyles({ transform: "translate(8px)" });
    // A single-argument translate has no y to read; zero is what CSS means by it.
    expect(readElementPose(document.createElement("div"))).toMatchObject({ x: 8, y: 0 });
  });

  it("reads the matrix a browser actually resolves a transform to", () => {
    stubStyles({ transform: "matrix(0.5, 0, 0, 0.25, 30, -10)" });
    expect(readElementPose(document.createElement("div"))).toEqual({
      x: 30,
      y: -10,
      scaleX: 0.5,
      scaleY: 0.25,
      rotate: 0
    });
  });

  it("reads a translate whose arguments are not numbers as no translate", () => {
    stubStyles({ transform: "translate(abc, def)" });
    expect(readElementPose(document.createElement("div"))).toMatchObject({ x: 0, y: 0 });
  });

  it("reads an element with no transform property at all", () => {
    // jsdom hands back the specified value, and a stubbed style object need not
    // carry the key. A missing transform is not a transform.
    stubStyles({});
    expect(readElementPose(document.createElement("div"))).toMatchObject({ x: 0, y: 0 });
  });

  it("reads no pose at all rather than a wrong one", () => {
    // A measurement corrected for a displacement the screen was not wearing
    // lands a screen-height away from anything, so anything unreadable is the
    // identity: nothing is undone, and the rect stands as measured.
    for (const transform of ["", "none", "matrix(1, 0, 0, 1)", "matrix(a, b, c, d, e, f)"]) {
      stubStyles({ transform });
      expect(readElementPose(document.createElement("div"))).toEqual({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotate: 0
      });
    }

    vi.stubGlobal("getComputedStyle", undefined);
    expect(readElementPose(document.createElement("div"))).toMatchObject({ x: 0, y: 0 });
  });
});

describe("followPose", () => {
  it("maps the ghost's box onto the element it is following", () => {
    expect(followPose(rect(20, 0, 200, 100), rect(50, 50, 100, 50))).toEqual({
      x: 20,
      y: -25,
      scaleX: 2,
      scaleY: 2,
      rotate: 0
    });
  });

  it("stands still for a box with no area", () => {
    // Dividing by an unlaid-out element's zero produces an infinity that
    // reaches the compositor.
    expect(followPose(rect(0, 0, 200, 100), rect(0, 0, 0, 40))).toMatchObject({ scaleX: 1 });
    expect(followPose(rect(0, 0, 200, 100), rect(0, 0, 40, 0))).toMatchObject({ scaleY: 1 });
  });
});
