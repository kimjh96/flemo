import { describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";
import cupertino from "@transition/cupertino";
import type { TransitionName } from "@transition/typing";
import { resolveVariantMotion } from "@transition/variantMotion";

import {
  classifyTransitionDriver,
  NATIVE_PEAK_CSS_PX_PER_FRAME,
  peakTranslationPxPerFrame
} from "@core/engine/motionDriverKind";

const BOX = { clientWidth: 400, clientHeight: 800 };

const custom = (
  targets: {
    initial: object;
    enter: object;
    exit?: object;
    duration?: number;
  },
  options?: object
) =>
  createTransition({
    name: "kind-test" as TransitionName,
    initial: targets.initial as never,
    idle: { value: { ...targets.enter } as never, options: { duration: 0 } },
    enter: { value: targets.enter as never, options: { duration: targets.duration ?? 0.35 } },
    enterBack: {
      value: targets.initial as never,
      options: { duration: targets.duration ?? 0.35 }
    },
    exit: {
      value: (targets.exit ?? targets.enter) as never,
      options: { duration: targets.duration ?? 0.35 }
    },
    exitBack: { value: targets.enter as never, options: { duration: targets.duration ?? 0.35 } },
    ...(options ? { options: options as never } : {})
  });

describe("peakTranslationPxPerFrame", () => {
  it("resolves percentage endpoints against the box and includes the easing peak", () => {
    const motion = resolveVariantMotion(cupertino, "PUSHING-true")!;
    const peak = peakTranslationPxPerFrame(motion, BOX)!;
    // 100% of 400px over 0.6s: mean ~11 CSS px/frame; the easing peak sits at
    // or above the mean.
    expect(peak).toBeGreaterThan(NATIVE_PEAK_CSS_PX_PER_FRAME);
  });

  it("a motion with no translation channels is not a mover", () => {
    const transition = custom({ initial: { opacity: 0 }, enter: { opacity: 1 } });
    const motion = resolveVariantMotion(transition, "PUSHING-true")!;
    expect(peakTranslationPxPerFrame(motion, BOX)).toBe(0);
  });

  it("an unparseable translation endpoint is unanalyzable", () => {
    const transition = custom({
      initial: { x: "calc(100% - 20px)" },
      enter: { x: 0 }
    });
    const motion = resolveVariantMotion(transition, "PUSHING-true")!;
    expect(peakTranslationPxPerFrame(motion, BOX)).toBeNull();
  });
});

describe("classifyTransitionDriver", () => {
  it("classifies a fast slide as native", () => {
    expect(classifyTransitionDriver(cupertino, "PUSHING", BOX)).toBe("native");
    expect(classifyTransitionDriver(cupertino, "POPPING", BOX)).toBe("native");
  });

  it("classifies a fade as player", () => {
    const fade = custom({ initial: { opacity: 0 }, enter: { opacity: 1 } });
    expect(classifyTransitionDriver(fade, "REPLACING", BOX)).toBe("player");
  });

  it("classifies a slow drift as player", () => {
    // 24px over 0.35s ≈ 1.1 px/frame mean — far under the boundary even at
    // its easing peak.
    const drift = custom({ initial: { x: 24, opacity: 0 }, enter: { x: 0, opacity: 1 } });
    expect(classifyTransitionDriver(drift, "REPLACING", BOX)).toBe("player");
  });

  it("one fast participant makes the whole navigation native", () => {
    // Active side fades in place, passive side sweeps 100%: one driver for
    // the pair, decided by the fastest participant.
    const mixed = custom({
      initial: { x: 0, opacity: 0 },
      enter: { x: 0, opacity: 1 },
      exit: { x: "-100%" }
    });
    expect(classifyTransitionDriver(mixed, "PUSHING", BOX)).toBe("native");
  });

  it("an unanalyzable choreography keeps the player", () => {
    const weird = custom({ initial: { x: "calc(100% - 20px)" }, enter: { x: 0 } });
    expect(classifyTransitionDriver(weird, "PUSHING", BOX)).toBe("player");
  });

  it("an authored driver overrides the measurement both ways", () => {
    const pinnedPlayer = custom({ initial: { x: "100%" }, enter: { x: 0 } }, { driver: "player" });
    const pinnedNative = custom(
      { initial: { opacity: 0 }, enter: { opacity: 1 } },
      { driver: "native" }
    );
    expect(classifyTransitionDriver(pinnedPlayer, "PUSHING", BOX)).toBe("player");
    expect(classifyTransitionDriver(pinnedNative, "REPLACING", BOX)).toBe("native");
  });

  it("a zero-size box classifies as player (nothing measurably moves)", () => {
    expect(
      classifyTransitionDriver(cupertino, "PUSHING", { clientWidth: 0, clientHeight: 0 })
    ).toBe("player");
  });
});
