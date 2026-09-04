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
  const rect = (x: number, width: number): MorphRect => ({ x, y: 10, width, height: 32 });
  const growing: MorphTravel = { ...travel, from: IDENTITY_POSE };

  it("holds a box whose contents were MEASURED not to move, and clips it instead", () => {
    // The narrower end is a clip over the wider one: 80 of 160 is half the box,
    // so the flight opens at a 50% left inset and closes at none. One layout,
    // one raster, and the same picture at every size on the way.
    const { rules } = buildMorphKeyframes({
      id: "9i",
      travel: growing,
      box: { from: rect(300, 80), to: rect(220, 160) },
      contentsHold: true,
      fade: null,
      paint: [],
      pinned: true,
      travelPinned: true
    });
    const travelRule = rules.join("\n");
    expect(travelRule).toContain("--flemo-box-w: 160px");
    expect(travelRule).not.toContain("--flemo-box-w: 80px");
    expect(travelRule).toContain("clip-path: inset(0% 0.000% 0.000% 50.000%)");
    expect(travelRule).toContain("clip-path: inset(0% 0.000% 0.000% 0.000%)");
  });

  it("cuts a LEFT-anchored growth from the edges it grows towards", () => {
    // Two ends that share a LEFT edge: the box grows rightward and downward
    // from where it sits, so the cut is on the right and the bottom. The same
    // one layout, on a corner the old shape test could not reach at all.
    const { rules } = buildMorphKeyframes({
      id: "9k",
      travel: growing,
      box: {
        from: { x: 220, y: 10, width: 80, height: 16 },
        to: { x: 220, y: 10, width: 160, height: 32 }
      },
      contentsHold: true,
      fade: null,
      paint: [],
      pinned: true,
      travelPinned: true
    });
    const travelRule = rules.join("\n");
    expect(travelRule).toContain("--flemo-box-w: 160px");
    expect(travelRule).not.toContain("--flemo-box-w: 80px");
    expect(travelRule).toContain("clip-path: inset(0% 50.000% 50.000% 0.000%)");
    expect(travelRule).toContain("clip-path: inset(0% 0.000% 0.000% 0.000%)");
  });

  it("lays the box out at every size where the contents were not proven still", () => {
    const { rules } = buildMorphKeyframes({
      id: "9j",
      travel: growing,
      box: { from: rect(300, 80), to: rect(220, 160) },
      contentsHold: false,
      fade: null,
      paint: [],
      pinned: true,
      travelPinned: true
    });
    const travelRule = rules.join("\n");
    expect(travelRule).toContain("--flemo-box-w: 160px");
    expect(travelRule).toContain("--flemo-box-w: 80px");
    expect(travelRule).not.toContain("clip-path");
  });

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

  // WHO ELSE HAS TO WAIT FOR THIS KEYFRAME.
  //
  // The flag is not decoration: a camera carrying this element reads it to
  // decide which thread it is presented from, and getting it wrong is the two
  // of them drifting apart by however far behind the main thread is.
  it("reports a transform-only travel as one the compositor can run", () => {
    expect(
      buildMorphKeyframes({ id: "1a", travel, fade: null, paint: [] }).geometryAccelerated
    ).toBe(true);
  });

  it("reports a travel carrying a box as one it cannot", () => {
    expect(
      buildMorphKeyframes({
        id: "1b",
        travel,
        box: {
          from: { x: 0, y: 0, width: 10, height: 10 },
          to: { x: 0, y: 0, width: 20, height: 20 }
        },
        fade: null,
        paint: []
      }).geometryAccelerated
    ).toBe(false);
  });

  it("reports type that re-typesets as one it cannot either", () => {
    // Anything but the transform takes the whole keyframe off the compositor,
    // not just a box: a font size is resolved by the main thread too.
    expect(
      buildMorphKeyframes({
        id: "1c",
        travel,
        fontSize: { from: 14, to: 24 },
        fade: null,
        paint: []
      }).geometryAccelerated
    ).toBe(false);
  });

  // ONE FLIGHT, ONE THREAD.
  //
  // The parts of a flight are placed relative to each other, so a part the
  // compositor can run on its own advances on frames the element travelling by
  // its box never reached. Pinning is how a part gives that up.
  describe("pinned", () => {
    const pin = (over: Partial<Parameters<typeof buildMorphKeyframes>[0]> = {}) =>
      buildMorphKeyframes({ id: "1p", travel, fade: null, paint: [], pinned: true, ...over });

    it("animates the pose's coordinates instead of the transform", () => {
      const { rules } = pin();
      const geometry = rules.find((rule) => rule.includes("-travel"))!;

      expect(geometry).toContain("--flemo-pose-x: -100px;");
      expect(geometry).toContain("--flemo-pose-sx: 0.25;");
      expect(geometry).not.toContain("transform:");
    });

    it("hands back the transform that reads them", () => {
      // The keyframes move the coordinates; something still has to compose them
      // into a transform, and that is the caller's to write on the element.
      expect(pin().transform).toContain("var(--flemo-pose-x)");
    });

    it("writes every channel at both ends, changed or not", () => {
      // These are the coordinates of one transform, not five animations: an end
      // that omitted a channel would interpolate it from the registered initial
      // value rather than holding it.
      const geometry = pin().rules.find((rule) => rule.includes("-travel"))!;
      // The arrival's stop is the one that carries to 100% (see `arrived`).
      const to = geometry.slice(geometry.indexOf("%, 100% {"));

      for (const axis of ["x", "y", "sx", "sy", "r"]) expect(to).toContain(`--flemo-pose-${axis}:`);
    });

    it("says a pinned set is not on the compositor either", () => {
      // A camera reads this to decide its own thread, and a set that reported
      // itself accelerated while being pinned would send the camera the other
      // way.
      expect(pin().geometryAccelerated).toBe(false);
      expect(pin().transform).not.toBeNull();
    });

    it("leaves an end that composes two poses literal rather than approximating it", () => {
      // `transform: A B` is a matrix product, and five numbers say one pose.
      // Rather than guess at a composition it cannot express, the set stays as
      // it was, which is honest about being accelerated.
      // `travel.from` is already a measured pose; an authored flourish on the
      // same end makes two.
      const stacked = pin({
        travel: { ...travel, authoredFrom: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotate: 0 } }
      });

      expect(stacked.transform).toBeNull();
      expect(stacked.rules.find((rule) => rule.includes("-travel"))).toContain("transform:");
    });

    it("changes nothing for a set that was never the compositor's to run", () => {
      // A box travel is already the main thread's, and pinning has nothing to
      // add to it.
      const boxed = pin({
        box: {
          from: { x: 0, y: 0, width: 10, height: 10 },
          to: { x: 0, y: 0, width: 20, height: 20 }
        }
      });

      expect(boxed.geometryAccelerated).toBe(false);
      expect(boxed.rules.find((rule) => rule.includes("-travel"))).toContain("left:");
    });
  });

  // A LEADING THAT DOES NOT DRIFT.
  //
  // The line-height rides its own animation because it needs its own timing:
  // each stop HOLDS until the next, which is what a staircase is, and one
  // keyframe cannot hold a channel while easing the rest.
  describe("a line-height staircase", () => {
    const stairs = [
      { at: 0, lineHeight: 20 },
      { at: 40, lineHeight: 25 },
      { at: 100, lineHeight: 32 }
    ];
    const built = () =>
      buildMorphKeyframes({
        id: "1s",
        travel,
        lineHeight: { from: 20, to: 32 },
        leading: stairs,
        fade: null,
        paint: []
      });

    it("rides its own animation, holding each value until the next", () => {
      const { rules, animation } = built();
      const lead = rules.find((rule) => rule.includes("-lead"))!;

      expect(lead).toContain("0.0000% {");
      expect(lead).toContain("line-height: 20px;");
      expect(lead).toContain("line-height: 32px;");
      expect(lead).toContain("animation-timing-function: steps(1, end);");
      expect(animation).toContain("flemo-morph-1s-lead");
    });

    it("runs linear, because the stops already carry the flight's curve", () => {
      // They sit where the ease reaches each face height; easing between them
      // again would move them off it.
      expect(built().animation).toContain("flemo-morph-1s-lead 0.400s linear");
    });

    it("takes the channel off the geometry keyframe, so the two cannot both author it", () => {
      const geometry = built().rules.find((rule) => rule.includes("-travel"))!;

      expect(geometry).not.toContain("line-height");
    });

    it("leaves the geometry keyframe alone where there are no stairs to climb", () => {
      const plain = buildMorphKeyframes({
        id: "1t",
        travel,
        lineHeight: { from: 20, to: 32 },
        leading: null,
        fade: null,
        paint: []
      });

      expect(plain.rules.find((rule) => rule.includes("-travel"))).toContain("line-height: 20px;");
      expect(plain.rules.some((rule) => rule.includes("-lead"))).toBe(false);
    });

    // A box travel with no pose of its own, which is what a type morph is.
    const plain: MorphTravel = { ...travel, from: IDENTITY_POSE };

    it("carries the ascent's staircase backwards on the box", () => {
      // A held leading still leaves the BASELINE stepping, because it sits an
      // ascent below the inline box and the ascent is on the same grid. The box
      // is not on any grid, so the flight sends it the other way by exactly as
      // much and the glyphs come out still.
      const lifted = buildMorphKeyframes({
        id: "1u",
        travel: plain,
        box: {
          from: { x: 0, y: 100, width: 10, height: 10 },
          to: { x: 0, y: 300, width: 20, height: 20 }
        },
        lineHeight: { from: 20, to: 32 },
        leading: stairs,
        lift: [
          { at: 0, ascent: 13 },
          { at: 40, ascent: 16 },
          { at: 100, ascent: 23 }
        ],
        travelPinned: true,
        fade: null,
        paint: []
      });
      const geometry = lifted.rules.find((rule) => rule.includes("-travel"))!;
      const rise = lifted.rules.find((rule) => rule.includes("-lift"))!;

      // The box travels to `top + ascent` at each end...
      // The move channel carries the box back AND the ascent up: from is
      // (100 + 13) - 300 = -187, and to is (300 + 23) - 300 = 23.
      expect(geometry).toContain("--flemo-move-y: -187px;");
      expect(geometry).toContain("--flemo-move-y: 23px;");
      // ...and the lift takes exactly that back off again, on the same channel.
      expect(rise).toContain("--flemo-lift-y: -13px;");
      expect(rise).toContain("--flemo-lift-y: -23px;");
      expect(rise).toContain("animation-timing-function: steps(1, end);");
      expect(lifted.animation).toContain("flemo-morph-1u-lift");
    });

    it("refuses to lift a set with no box to cancel against", () => {
      // A nested pair rides its container and has no box channel of its own, so
      // there is nowhere to send the box up by the amount the transform takes
      // off. Emitting half of a cancellation leaves the line an ascent too high
      // — device-reported from the poster grid as a title starting twelve
      // pixels up.
      const riding = buildMorphKeyframes({
        id: "1x",
        travel: plain,
        fontSize: { from: 14, to: 24 },
        leading: stairs,
        lift: [
          { at: 0, ascent: 13 },
          { at: 100, ascent: 23 }
        ],
        fade: null,
        paint: []
      });

      expect(riding.rules.some((rule) => rule.includes("-lift"))).toBe(false);
    });

    it("refuses to lift a set that writes a transform of its own", () => {
      // The two would be fighting over one property, and a box sent up with
      // nothing to bring it back down is a line of type an ascent too low.
      const posed = buildMorphKeyframes({
        id: "1v",
        travel: { ...travel, authoredFrom: { x: 0, y: 8, scaleX: 1, scaleY: 1, rotate: 0 } },
        box: {
          from: { x: 0, y: 100, width: 10, height: 10 },
          to: { x: 0, y: 300, width: 20, height: 20 }
        },
        lineHeight: { from: 20, to: 32 },
        leading: stairs,
        lift: [
          { at: 0, ascent: 13 },
          { at: 100, ascent: 23 }
        ],
        fade: null,
        paint: []
      });

      expect(posed.rules.some((rule) => rule.includes("-lift"))).toBe(false);
      expect(posed.rules.find((rule) => rule.includes("-travel"))).toContain("top: 100px;");
    });

    it("leaves the box where it was when there is no staircase to cancel", () => {
      const unlifted = buildMorphKeyframes({
        id: "1w",
        travel: plain,
        box: {
          from: { x: 0, y: 100, width: 10, height: 10 },
          to: { x: 0, y: 300, width: 20, height: 20 }
        },
        leading: null,
        lift: [
          { at: 0, ascent: 13 },
          { at: 100, ascent: 23 }
        ],
        fade: null,
        paint: []
      });

      expect(unlifted.rules.find((rule) => rule.includes("-travel"))).toContain("top: 100px;");
      expect(unlifted.rules.some((rule) => rule.includes("-lift"))).toBe(false);
    });

    it("is the main thread's work, and says so", () => {
      // A line-height is not something a compositor can run, so a set carrying
      // one cannot be accelerated and anything registered with it must know.
      expect(built().geometryAccelerated).toBe(false);
    });
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
    // The destination is stated at its own stop AND held to the end: the last
    // frame a flight is painted on is not its 100%, and for type a hair short
    // of the resting size is a whole pixel of ascent (see `arrived`).
    expect(rules[0]).toContain("0% {");
    expect(rules[0]).toContain("%, 100% {");
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
      selector: "[data-flemo-screen]",
      accelerated: true
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
      selector: "[data-flemo-screen]",
      accelerated: true
    });

    expect(settling.rules[0]).toMatch(/0% \{\n {4}transform: translate/);
    // And it ARRIVES a frame early, like every other channel: a camera whose
    // last painted frame is a sliver short of its endpoint releases that
    // sliver of zoom on the landing frame, moving the whole screen by it.
    expect(settling.rules[0]).toContain("95.833%, 100% {\n    transform: none;");
  });

  // A CAMERA IS ONLY RIGHT WHILE IT AGREES WITH WHAT IT CARRIES.
  //
  // Both forms describe the same zoom on the same clock. The difference is which
  // thread presents them: a literal transform is one a compositor runs on its
  // own, and a transform composed from registered custom properties is one it
  // cannot, so the camera advances on exactly the frames the element does.
  describe("pinned to the main thread", () => {
    const pinned = buildCameraKeyframes({
      id: "11i",
      origin: { x: 0, y: 0 },
      small: { x: 100, y: 200, width: 100, height: 100 },
      big: { x: 0, y: 0, width: 400, height: 800 },
      settling: false,
      duration: 0.4,
      start: 0,
      ease: undefined,
      selector: "[data-flemo-screen]",
      accelerated: false
    });

    it("animates the camera's coordinates instead of the transform", () => {
      expect(pinned.rules[0]).toContain("--flemo-pose-sx: 4;");
      expect(pinned.rules[0]).toContain("--flemo-pose-sx: 1;");
      expect(pinned.rules[0]).not.toContain("transform:");
    });

    it("says the zoom as the pose every other part of the flight is said in", () => {
      // One uniform scale, so both axes carry it, and no rotation. Written
      // through the same five coordinates a ghost or a nested pair uses, which
      // is what lets one registration serve the whole flight.
      expect(pinned.rules[0]).toContain("--flemo-pose-sy: 4;");
      expect(pinned.rules[0]).toContain("--flemo-pose-r: 0deg;");
    });

    it("composes the transform from them on the element itself", () => {
      expect(pinned.rules[1]).toContain(
        "transform: translate3d(var(--flemo-pose-x), var(--flemo-pose-y), 0) scale(var(--flemo-pose-sx), var(--flemo-pose-sy)) rotate(var(--flemo-pose-r)) !important;"
      );
    });

    it("resolves to the identity at the resting end", () => {
      // `none` has no equivalent to write into three coordinates, so rest is
      // spelled out: no translation and a scale of one.
      expect(pinned.rules[0]).toContain("--flemo-pose-x: 0px;");
      expect(pinned.rules[0]).toContain("--flemo-pose-y: 0px;");
    });

    it("keeps the same clock as the accelerated form", () => {
      expect(pinned.rules[1]).toContain("animation-duration: 0.400s !important");
      expect(pinned.rules[1]).toContain("animation-fill-mode: both !important");
    });
  });
});

describe("buildMorphKeyframes() tracking", () => {
  const track = [
    { at: 0, fix: 0 },
    { at: 30, fix: -0.05 },
    { at: 100, fix: 0 }
  ];

  it("carries the correction beside the author's own tracking on one property", () => {
    const built = buildMorphKeyframes({
      id: "3t",
      travel,
      fade: null,
      paint: [],
      travelPinned: true,
      fontSize: { from: 14, to: 24 },
      letterSpacing: { from: -0.18, to: -0.48 },
      track
    });

    // Two clocks on one property: neither can author `letter-spacing` alone.
    expect(built.letterSpacing).toBe("calc(var(--flemo-track) + var(--flemo-track-fix))");
    const travelRule = built.rules.find((rule) => rule.includes("-travel"))!;
    expect(travelRule).toContain("--flemo-track: -0.18px");
    expect(travelRule).toContain("--flemo-track: -0.48px");
    expect(travelRule).not.toContain("letter-spacing:");
  });

  // A HELD CORRECTION LEAVES ITS OWN STEP BEHIND.
  //
  // The lift beside it holds, because a staircase is what it cancels. This
  // cancels a smooth curve, so holding a sample until the next one puts the
  // whole climb between them back on the glass.
  it("ramps between its stops rather than holding them", () => {
    const built = buildMorphKeyframes({
      id: "4t",
      travel,
      fade: null,
      paint: [],
      travelPinned: true,
      fontSize: { from: 14, to: 24 },
      track
    });

    const rule = built.rules.find((r) => r.startsWith("@keyframes flemo-morph-4t-track"))!;
    expect(rule).toContain("--flemo-track-fix: -0.05px");
    expect(rule).not.toContain("steps(1, end)");
  });

  it("leaves the property alone where there is no correction to carry", () => {
    const built = buildMorphKeyframes({
      id: "5t",
      travel,
      fade: null,
      paint: [],
      travelPinned: true,
      fontSize: { from: 14, to: 24 },
      track: null
    });

    expect(built.letterSpacing).toBeNull();
    expect(built.rules.some((rule) => rule.includes("-track {"))).toBe(false);
  });
});

// WHOEVER WRITES THE CHANNEL MUST ALSO WEAR IT.
describe("buildMorphKeyframes() move channel", () => {
  const lift = [
    { at: 0, ascent: 12 },
    { at: 50, ascent: 13 },
    { at: 100, ascent: 14 }
  ];
  const leading = [
    { at: 0, lineHeight: 18 },
    { at: 50, lineHeight: 19 },
    { at: 100, lineHeight: 20 }
  ];

  it("wears the channel for a pair that rides its container, which has no box and no pose", () => {
    // The case that was dead: neither a box travel nor a pose of its own, and
    // an ascent staircase whose cancellation had nothing reading it.
    const built = buildMorphKeyframes({
      id: "6r",
      travel: { ...travel, from: IDENTITY_POSE },
      fade: null,
      paint: [],
      travelPinned: true,
      fontSize: { from: 13, to: 24 },
      leading,
      lift
    });

    expect(built.translate).toBe(
      "var(--flemo-move-x) calc(var(--flemo-move-y) + var(--flemo-lift-y))"
    );
    const rule = built.rules.find((r) => r.startsWith("@keyframes flemo-morph-6r-travel"))!;
    expect(rule).toContain("--flemo-move-y: 12px");
  });

  it("pays the half-leading the staircase does not render at the departure", () => {
    const built = buildMorphKeyframes({
      id: "7r",
      travel: { ...travel, from: IDENTITY_POSE },
      fade: null,
      paint: [],
      travelPinned: true,
      fontSize: { from: 13, to: 24 },
      leading,
      lift,
      leadStart: 1
    });

    const rule = built.rules.find((r) => r.startsWith("@keyframes flemo-morph-7r-travel"))!;
    // The ascent at the start plus what the baseline owes, and the landing
    // untouched: the last stop is the arrival's own line.
    expect(rule).toContain("--flemo-move-y: 13px");
    expect(rule).toContain("--flemo-move-y: 14px");
  });
});

// A BOX THAT ANIMATES ITS OWN SIZE MUST NOT WRITE IT DIRECTLY.
describe("buildMorphKeyframes() box size", () => {
  const box = {
    from: { x: 0, y: 0, width: 80, height: 80 } as MorphRect,
    to: { x: 0, y: 0, width: 400, height: 300 } as MorphRect
  };

  it("drives the size through the channel wherever the keyframe animates properties", () => {
    // WebKit drops an animated `width` on an element that is also animating a
    // custom property. Reading the size from a registered length instead gives
    // the engine nothing but custom properties to interpolate.
    const built = buildMorphKeyframes({
      id: "8b",
      travel,
      fade: null,
      paint: [],
      travelPinned: true,
      box
    });

    expect(built.size).toEqual({ width: "var(--flemo-box-w)", height: "var(--flemo-box-h)" });
    const rule = built.rules.find((r) => r.startsWith("@keyframes flemo-morph-8b-travel"))!;
    expect(rule).toContain("--flemo-box-w: 80px");
    expect(rule).toContain("--flemo-box-h: 300px");
    expect(rule).not.toContain("width: 80px");
  });

  it("writes the size plainly where the keyframe animates nothing else through a property", () => {
    const built = buildMorphKeyframes({
      id: "9b",
      travel,
      fade: null,
      paint: [],
      box
    });

    expect(built.size).toBeNull();
    const rule = built.rules.find((r) => r.startsWith("@keyframes flemo-morph-9b-travel"))!;
    expect(rule).toContain("width: 80px");
    expect(rule).not.toContain("--flemo-box-w");
  });

  it("has no size to wear where there is no box", () => {
    expect(
      buildMorphKeyframes({ id: "10b", travel, fade: null, paint: [], travelPinned: true }).size
    ).toBeNull();
  });
});
