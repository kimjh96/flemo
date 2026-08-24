import { describe, expect, it } from "vitest";

import { buildMorphKeyframes, type MorphTravel } from "@morph/morphKeyframes";

import { IDENTITY_POSE } from "@morph/morphPose";

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
