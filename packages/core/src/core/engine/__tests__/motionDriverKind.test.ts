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
  // The default is the PLAYER on every engine (see the module comment: on
  // WebKit the compiled clock's stamp-to-glass pipeline ages every cold
  // flight's opening; the player is immune by construction). Blink
  // expectations stub the probe only to prove engine-independence.
  const asBlink = <T>(run: () => T): T => {
    const nav = navigator as { userAgentData?: unknown };
    nav.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    try {
      return run();
    } finally {
      delete nav.userAgentData;
    }
  };

  it("every kind rides the player by default, on every engine", () => {
    const fade = custom({ initial: { opacity: 0 }, enter: { opacity: 1 } });
    const weird = custom({ initial: { x: "calc(100% - 20px)" }, enter: { x: 0 } });
    expect(classifyTransitionDriver(cupertino, "PUSHING", BOX)).toBe("player");
    expect(classifyTransitionDriver(cupertino, "POPPING", BOX)).toBe("player");
    expect(classifyTransitionDriver(fade, "REPLACING", BOX)).toBe("player");
    expect(classifyTransitionDriver(weird, "PUSHING", BOX)).toBe("player");
    asBlink(() => {
      expect(classifyTransitionDriver(cupertino, "PUSHING", BOX)).toBe("player");
      expect(classifyTransitionDriver(fade, "REPLACING", BOX)).toBe("player");
    });
  });

  it("an authored driver overrides the default both ways", () => {
    const pinnedPlayer = custom({ initial: { x: "100%" }, enter: { x: 0 } }, { driver: "player" });
    const pinnedNative = custom(
      { initial: { opacity: 0 }, enter: { opacity: 1 } },
      { driver: "native" }
    );
    expect(classifyTransitionDriver(pinnedPlayer, "PUSHING", BOX)).toBe("player");
    expect(classifyTransitionDriver(pinnedNative, "REPLACING", BOX)).toBe("native");
    asBlink(() => {
      expect(classifyTransitionDriver(pinnedPlayer, "PUSHING", BOX)).toBe("player");
      expect(classifyTransitionDriver(pinnedNative, "REPLACING", BOX)).toBe("native");
    });
  });
});
