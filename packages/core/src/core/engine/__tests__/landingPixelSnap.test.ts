import { describe, expect, it } from "vitest";

import { resolveEasing } from "@transition/cubicBezier";

import type { VariantMotion } from "@transition/variantMotion";

import {
  governedBezierForMotion,
  governedEasingForMotion,
  snappedEasingForMotion,
  SNAP_BAND_MAX_DEVICE_PX,
  SNAP_VELOCITY_DEVICE_PX_PER_FRAME
} from "@core/engine/landingPixelSnap";

// The landing pixel snap (landingPixelSnap.ts): the compiled animation's
// easing reshaped into a CSS linear() whose tail is plateaus-and-jumps on
// integer device pixels — ONE animation, still compositor-driven (the
// overlay approach was traced demoting the whole flight to the main thread:
// Animation compositeFailed=64, kTargetHasIncompatibleAnimations).

const cupertinoish = (overrides: Partial<VariantMotion> = {}): VariantMotion => ({
  from: { x: "100%" },
  to: { x: 0 },
  duration: 0.7,
  delay: 0,
  ease: [0.32, 0.72, 0, 1],
  ...overrides
});

const box = { clientWidth: 500, clientHeight: 900 };

// Parse "linear(p1 t1%, p2 t2%, ...)" into [{p, t}].
const parsePoints = (easing: string) =>
  [...easing.matchAll(/([\d.]+) ([\d.]+)%/g)].map((m) => ({ p: +m[1], t: +m[2] }));

describe("snappedEasingForMotion", () => {
  it("reshapes the curve into a linear() ending in integer-device-pixel plateaus", () => {
    const easing = snappedEasingForMotion(cupertinoish(), box, 2)!;
    expect(easing).toMatch(/^linear\(/);
    const points = parsePoints(easing);
    const dominantDevice = 500 * 2;

    // Time never regresses; progress is monotone for this curve; endpoints
    // pinned.
    let previous = { p: -1, t: -1 };
    for (const point of points) {
      expect(point.t).toBeGreaterThanOrEqual(previous.t);
      expect(point.p).toBeGreaterThanOrEqual(previous.p);
      previous = point;
    }
    expect(points[0]).toEqual({ p: 0, t: 0 });
    expect(points[points.length - 1]).toEqual({ p: 1, t: 100 });

    // Every plateau (duplicated progress) sits on an integer device pixel of
    // remaining travel, and plateaus exist.
    let plateaus = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].p === points[i - 1].p && points[i].t > points[i - 1].t) {
        plateaus += 1;
        const remainingDevice = (1 - points[i].p) * dominantDevice;
        expect(Math.abs(remainingDevice - Math.round(remainingDevice))).toBeLessThan(1e-3);
      }
    }
    expect(plateaus).toBeGreaterThan(10);
    expect(plateaus).toBeLessThanOrEqual(SNAP_BAND_MAX_DEVICE_PX + 1);

    // Rest (progress 1) is reached BEFORE 100% — the same sub-device-pixel
    // crossing the perceptual cut uses — and held to the end.
    const firstRest = points.find((point) => point.p === 1)!;
    expect(firstRest.t).toBeLessThan(100);
  });

  it("the reshaped tail tracks the authored curve within one device pixel", () => {
    const motion = cupertinoish();
    const easing = snappedEasingForMotion(motion, box, 2)!;
    const points = parsePoints(easing);
    const dominantDevice = 500 * 2;
    // Piecewise-linear evaluation of the reshaped easing.
    const reshaped = (t: number): number => {
      for (let i = 1; i < points.length; i++) {
        if (t <= points[i].t) {
          const a = points[i - 1];
          const b = points[i];
          if (b.t === a.t) return b.p;
          return a.p + ((b.p - a.p) * (t - a.t)) / (b.t - a.t);
        }
      }
      return 1;
    };
    // Against the authored bezier: bounded everywhere by plateau depth (1px)
    // plus the sample-grid timing quantization at band-entry velocity
    // (~1.3px at 6px/frame) — a transient at the band edge, imperceptible in
    // motion...
    const authored = resolveEasing(motion.ease);
    let worstDevice = 0;
    let worstTailDevice = 0;
    for (let t = 0; t <= 100; t += 0.25) {
      const deviation = Math.abs(reshaped(t) - authored(t / 100)) * dominantDevice;
      worstDevice = Math.max(worstDevice, deviation);
      if (t >= 90) worstTailDevice = Math.max(worstTailDevice, deviation);
    }
    expect(worstDevice).toBeLessThanOrEqual(3);
    // ...while the settle frames themselves — where the eye rests — stay
    // within the plateau's own single pixel.
    expect(worstTailDevice).toBeLessThanOrEqual(1.5);
  });

  it("adapts to width: a wider box enters its snap band later on the clock", () => {
    const narrow = parsePoints(snappedEasingForMotion(cupertinoish(), box, 2)!);
    const wide = parsePoints(
      snappedEasingForMotion(cupertinoish(), { clientWidth: 1512, clientHeight: 900 }, 2)!
    );
    const firstPlateauTime = (points: { p: number; t: number }[]) => {
      for (let i = 1; i < points.length; i++) {
        if (points[i].p === points[i - 1].p && points[i].t > points[i - 1].t)
          return points[i - 1].t;
      }
      return 100;
    };
    expect(firstPlateauTime(wide)).toBeGreaterThan(firstPlateauTime(narrow));
  });

  it("bails on channels the shared easing would visibly step", () => {
    // Opacity animates on the SAME keyframes — a stepped fade is visible.
    expect(
      snappedEasingForMotion(
        cupertinoish({ from: { x: "100%", opacity: 0 }, to: { x: 0, opacity: 1 } }),
        box,
        2
      )
    ).toBeNull();
    expect(
      snappedEasingForMotion(
        cupertinoish({ from: { x: "100%", scale: 0.9 }, to: { x: 0, scale: 1 } }),
        box,
        2
      )
    ).toBeNull();
  });

  it("bails when nothing meaningfully travels or the band overshoots", () => {
    expect(
      snappedEasingForMotion(cupertinoish({ from: { x: "1px" }, to: { x: 0 } }), box, 1)
    ).toBeNull();
    expect(snappedEasingForMotion(cupertinoish({ from: {}, to: {} }), box, 2)).toBeNull();
    // backOut overshoots inside the slow zone: the authored bounce is kept.
    expect(snappedEasingForMotion(cupertinoish({ ease: "backOut" }), box, 2)).toBeNull();
  });

  it("a constant channel coexisting with the travel does not veto", () => {
    expect(
      snappedEasingForMotion(
        cupertinoish({ from: { x: "100%", opacity: 1 }, to: { x: 0, opacity: 1 } }),
        box,
        2
      )
    ).not.toBeNull();
  });

  it("velocity threshold is honored: the band begins once travel is slower than the threshold", () => {
    const easing = snappedEasingForMotion(
      cupertinoish(),
      { clientWidth: 1512, clientHeight: 900 },
      2
    )!;
    const points = parsePoints(easing);
    const dominantDevice = 1512 * 2;
    // At the first plateau's entry, the authored curve's per-frame velocity
    // must be at or below the threshold.
    const authored = resolveEasing([0.32, 0.72, 0, 1]);
    let entryT = 100;
    for (let i = 1; i < points.length; i++) {
      if (points[i].p === points[i - 1].p && points[i].t > points[i - 1].t) {
        entryT = points[i - 1].t;
        break;
      }
    }
    const frameFraction = (1000 / 120 / 700) * 100; // one 120Hz frame in % of 0.7s
    const velocityDevice =
      Math.abs(authored((entryT + frameFraction) / 100) - authored(entryT / 100)) * dominantDevice;
    expect(velocityDevice).toBeLessThanOrEqual(SNAP_VELOCITY_DEVICE_PX_PER_FRAME + 1);
  });
});

// The compiled-tier landing governor (governedEasingForMotion): the
// reshaped curve follows the authored easing until its velocity drops below
// one device pixel per frame inside the engagement range, then sprints the
// remainder at exactly that velocity and rests early.
describe("governedEasingForMotion", () => {
  const box = { clientWidth: 1400, clientHeight: 800 } as unknown as HTMLElement;
  const cupertino = {
    from: { x: "100%" },
    to: { x: 0 },
    duration: 0.7,
    delay: 0,
    ease: [0.32, 0.72, 0, 1]
  } as VariantMotion;

  it("reshapes a flat-tailed slide into an early linear landing", () => {
    const easing = governedEasingForMotion(cupertino, box, 1, 1000 / 120);
    expect(easing).toMatch(/^linear\(/);
    // The reshaped curve reaches 1 strictly before 100% and holds it.
    const match = /1 (\d+\.?\d*)%, 1 100%\)$/.exec(easing!);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1]!)).toBeLessThan(100);
    expect(parseFloat(match![1]!)).toBeGreaterThan(80);
  });

  it("bails on non-translation channels and tiny motions", () => {
    expect(
      governedEasingForMotion(
        {
          ...cupertino,
          from: { x: "100%", opacity: 0 },
          to: { x: 0, opacity: 1 }
        } as VariantMotion,
        box,
        1,
        1000 / 120
      )
    ).toBeNull();
    expect(
      governedEasingForMotion({ ...cupertino, from: { x: 8 } } as VariantMotion, box, 1, 1000 / 120)
    ).toBeNull();
  });

  it("preserves an overshooting ease", () => {
    const bounce = { ...cupertino, ease: [0.34, 1.56, 0.64, 1] } as VariantMotion;
    expect(governedEasingForMotion(bounce, box, 1, 1000 / 120)).toBeNull();
  });
});

// The accelerated-WebKit governor (governedBezierForMotion): the governed
// curve as a pure cubic-bezier fit over a shortened duration — Core
// Animation carries nothing else.
describe("governedBezierForMotion", () => {
  const box = { clientWidth: 393, clientHeight: 760 } as unknown as HTMLElement;
  const cupertino = {
    from: { x: "100%" },
    to: { x: 0 },
    duration: 0.7,
    delay: 0,
    ease: [0.32, 0.72, 0, 1]
  } as VariantMotion;

  it("fits a firm early landing: shorter duration, bezier easing", () => {
    const fit = governedBezierForMotion(cupertino, box, 3, 1000 / 60);
    expect(fit).not.toBeNull();
    expect(fit!.durationMs).toBeLessThan(700);
    expect(fit!.durationMs).toBeGreaterThan(400);
    expect(fit!.easing).toMatch(/^cubic-bezier\(/);
  });

  it("bails on non-translation channels and overshoot", () => {
    expect(
      governedBezierForMotion(
        {
          ...cupertino,
          from: { x: "100%", opacity: 0 },
          to: { x: 0, opacity: 1 }
        } as VariantMotion,
        box,
        3,
        1000 / 60
      )
    ).toBeNull();
    expect(
      governedBezierForMotion(
        { ...cupertino, ease: [0.34, 1.56, 0.64, 1] } as VariantMotion,
        box,
        3,
        1000 / 60
      )
    ).toBeNull();
    expect(governedBezierForMotion(null, box, 3, 1000 / 60)).toBeNull();
  });
});
