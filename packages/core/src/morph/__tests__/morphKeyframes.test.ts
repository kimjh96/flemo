import { describe, expect, it } from "vitest";

import { buildCameraKeyframes, buildMorphKeyframes, type MorphTravel } from "@morph/morphKeyframes";
import { IDENTITY_POSE } from "@morph/morphPose";

import type { MorphRect } from "@morph/morphGeometry";

const travel: MorphTravel = {
  from: { x: -100, y: 200, scaleX: 0.25, scaleY: 0.5, rotate: 0 },
  authoredFrom: IDENTITY_POSE,
  authoredTo: IDENTITY_POSE,
  duration: 0.4,
  start: 0,
  ease: [0.32, 0.72, 0, 1]
};

describe("buildMorphKeyframes", () => {
  it("keeps the geometry keyframe to transform and nothing else", () => {
    // The rule the whole shape of this module follows: a keyframe listing a
    // property the compositor cannot animate drops that WHOLE animation to the
    // main thread, and the travel is the one that must never leave it.
    const { rules } = buildMorphKeyframes({
      id: "1i",
      travel,
      fade: { from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.12 },
      paint: [{ property: "border-radius", from: "36px / 24px", to: "12px" }]
    });

    const geometry = rules.find((rule) => rule.includes("-travel"))!;
    expect(geometry).toContain("transform:");
    expect(geometry).not.toContain("opacity");
    expect(geometry).not.toContain("border-radius");
  });

  it("gives the fade and the corner their own clocks", () => {
    // Different windows on purpose: the cross-fade has to be over while the two
    // sides still overlap, the corner has to track the scale for the whole
    // flight. One animation could not do both.
    const { rules, animation } = buildMorphKeyframes({
      id: "1i",
      travel,
      fade: { from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.12 },
      paint: [{ property: "border-radius", from: "36px / 24px", to: "12px" }]
    });

    expect(rules).toHaveLength(3);
    expect(animation).toContain("flemo-morph-1i-travel 0.400s");
    expect(animation).toContain("flemo-morph-1i-fade 0.120s");
    expect(animation).toContain("flemo-morph-1i-paint 0.400s");
  });

  it("is two endpoints and the authored easing — the element is on the layer", () => {
    // Nothing to sample and nothing to compose with: staged above both screens,
    // a morph has no screen motion underneath it.
    const { rules, animation } = buildMorphKeyframes({
      id: "2i",
      travel,
      fade: null,
      paint: []
    });

    expect(rules).toHaveLength(1);
    expect(rules[0]).toContain("from {");
    expect(rules[0]).toContain("to {");
    expect(rules[0]).toContain("translate3d(-100px, 200px, 0) scale(0.25, 0.5)");
    expect(rules[0]).toContain("transform: none");
    expect(animation).toContain("cubic-bezier(0.32, 0.72, 0, 1)");
  });

  it("composes an authored flourish on top of the measured travel", () => {
    const { rules } = buildMorphKeyframes({
      id: "3i",
      travel: {
        ...travel,
        authoredFrom: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: -6 },
        authoredTo: IDENTITY_POSE
      },
      fade: null,
      paint: []
    });

    expect(rules[0]).toContain("translate3d(-100px, 200px, 0) scale(0.25, 0.5) rotate(-6deg)");
  });

  it("rides the platform head as a delay", () => {
    const { animation } = buildMorphKeyframes({
      id: "4i",
      travel: { ...travel, start: 0.2 },
      fade: null,
      paint: []
    });

    expect(animation).toContain("0.200s both");
  });

  it("drops a fade with no duration rather than emitting a zero-length one", () => {
    const { rules } = buildMorphKeyframes({
      id: "5i",
      travel,
      fade: { from: { opacity: 0 }, to: { opacity: 1 }, duration: 0 },
      paint: []
    });

    expect(rules).toHaveLength(1);
  });
});

describe("the channels beside the travel", () => {
  const box = {
    from: { x: 0, y: 0, width: 100, height: 50 },
    to: { x: 10, y: 10, width: 200, height: 90 }
  };

  it("carries every type and spacing channel it was given", () => {
    // Type morphs by re-typesetting rather than by being scaled, and the box's
    // own gaps travel with it — a 14px/600 label growing into a 24px/800
    // heading passes through every face between.
    const { rules } = buildMorphKeyframes({
      id: "6i",
      travel,
      box,
      fontSize: { from: 14, to: 24 },
      fontWeight: { from: 600, to: 800 },
      letterSpacing: { from: -0.2, to: 0.4 },
      wordSpacing: { from: 0, to: 1.5 },
      lineHeight: { from: 18, to: 30 },
      aspectRatio: { from: "1 / 1", to: "3 / 2" },
      padding: { from: "4px 8px 4px 8px", to: "16px 20px 16px 20px" },
      margin: { from: "0px 0px 0px 0px", to: "8px 0px 8px 0px" },
      fade: null,
      paint: []
    });

    const geometry = rules[0]!;
    expect(geometry).toContain("font-size: 14px");
    expect(geometry).toContain("font-weight: 600");
    expect(geometry).toContain("letter-spacing: -0.2px");
    expect(geometry).toContain("word-spacing: 0px");
    expect(geometry).toContain("line-height: 18px");
    expect(geometry).toContain("aspect-ratio: 1 / 1");
    expect(geometry).toContain("padding: 4px 8px 4px 8px");
    expect(geometry).toContain("margin: 8px 0px 8px 0px");
    expect(geometry).toContain("width: 100px");
  });

  it("rounds a font weight to something CSS will take", () => {
    const { rules } = buildMorphKeyframes({
      id: "7i",
      travel,
      fontWeight: { from: 412.6, to: 700 },
      fade: null,
      paint: []
    });

    expect(rules[0]).toContain("font-weight: 413");
  });

  it("drops a fade whose two ends declare nothing", () => {
    // A fade target that is empty on both sides would emit a keyframe pair with
    // no declarations in it — a rule the browser parses and then animates
    // nothing with, on the clock the flight is watching.
    const { rules } = buildMorphKeyframes({
      id: "8i",
      travel,
      fade: { from: null, to: null, duration: 0.2 },
      paint: []
    });

    expect(rules).toHaveLength(1);
    expect(rules[0]).not.toContain("-fade");
  });
});

describe("buildCameraKeyframes", () => {
  const camera = (small: MorphRect) =>
    buildCameraKeyframes({
      id: "9i",
      origin: { x: 200, y: 400 },
      small,
      big: { x: 0, y: 0, width: 400, height: 800 },
      settling: false,
      duration: 0.4,
      start: 0,
      ease: [0.32, 0.72, 0, 1],
      selector: "[data-flemo-screen]"
    });

  it("scales from the width alone, and writes longhands rather than the shorthand", () => {
    // The shorthand would also write `animation-play-state`, and that longhand
    // belongs to the compiled hold: the camera has to pause and release with
    // its screen like everything else in the flight.
    const { rules, name } = camera({ x: 100, y: 200, width: 100, height: 100 });

    expect(name).toBe("flemo-morph-9i-camera");
    expect(rules[0]).toContain("scale(4)");
    expect(rules[1]).toContain("animation-name: flemo-morph-9i-camera !important");
    expect(rules[1]).not.toContain("animation:");
  });

  it("holds the camera still for a box with no width to scale from", () => {
    expect(camera({ x: 0, y: 0, width: 0, height: 100 }).rules[0]).toContain("scale(1)");
  });

  it("starts zoomed and settles when the screen it rides is the one arriving", () => {
    const settling = buildCameraKeyframes({
      id: "10i",
      origin: { x: 0, y: 0 },
      small: { x: 0, y: 0, width: 100, height: 100 },
      big: { x: 0, y: 0, width: 200, height: 200 },
      settling: true,
      duration: 0.4,
      start: 0,
      ease: undefined,
      selector: "[data-flemo-screen]"
    });

    expect(settling.rules[0]).toMatch(/from \{\n {4}transform: translate/);
    expect(settling.rules[0]).toContain("to {\n    transform: none;");
  });
});
