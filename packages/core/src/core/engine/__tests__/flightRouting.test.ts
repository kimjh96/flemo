import { afterEach, describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";

import type { Transition } from "@transition/typing";

import { resolveFlightRouting } from "@core/engine/flightRouting";
import { reportDisplayIntervalMs, resetDisplayCadenceForTests } from "@platform/displayCadence";

// HOW ONE FLIGHT IS FLOWN. The platform profile answers "what browser is
// this"; this answers "so what does THIS navigation get" — which opening
// treatment, and whether the engine may touch the clock.
//
// Every field here was a `const` buried in driveScreenLifecycle, reachable
// only by driving a whole engine. Pinning them directly is the point of
// pulling them out: a routing change now fails a routing test.

const NAV = navigator as { userAgentData?: unknown };

const setEnv = (over: {
  blink?: boolean;
  touch?: boolean;
  mac?: boolean;
  android?: boolean;
  uaCh?: boolean;
}) => {
  const { blink = false, touch = false, mac = false, android = false, uaCh = true } = over;
  if (blink && uaCh) NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
  else delete NAV.userAgentData;
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch ? 5 : 0, configurable: true });
  Object.defineProperty(navigator, "platform", {
    value: mac ? "MacIntel" : "",
    configurable: true
  });
  Object.defineProperty(navigator, "userAgent", {
    value: android ? "Mozilla/5.0 (Linux; Android 10; SM-N960N) AppleWebKit/537.36 Chrome/120" : "",
    configurable: true
  });
};

const slide = (options?: { driver?: "native" }) =>
  createTransition({
    name: "routing-test" as never,
    initial: { x: "100%" },
    idle: { value: { x: 0 }, options: { duration: 0 } },
    enter: { value: { x: 0 }, options: { duration: 0.3 } },
    enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
    exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
    exitBack: { value: { x: 0 }, options: { duration: 0.3 } },
    ...(options ? { options } : {})
  }) as Transition;

const route = (
  over: Partial<Parameters<typeof resolveFlightRouting>[0]> & { status?: string } = {}
) =>
  resolveFlightRouting({
    status: "PUSHING",
    transition: slide(),
    skipAnimation: false,
    hasActiveMotion: true,
    hasAnimation: true,
    ...over
  });

afterEach(() => {
  delete NAV.userAgentData;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  delete (navigator as unknown as Record<string, unknown>).platform;
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  sessionStorage.clear();
  resetDisplayCadenceForTests();
});

describe("hasDrivableMotion", () => {
  it("needs both an unskipped scope and a motion that resolves", () => {
    setEnv({ blink: false, touch: true });
    expect(route().hasDrivableMotion).toBe(true);
    expect(route({ skipAnimation: true }).hasDrivableMotion).toBe(false);
    expect(route({ hasActiveMotion: false }).hasDrivableMotion).toBe(false);
  });
});

describe("nativeSurgeryAllowed", () => {
  it("is an authored opt-in, and never granted on Blink", () => {
    setEnv({ blink: false, touch: true });
    expect(route().nativeSurgeryAllowed).toBe(false);
    expect(route({ transition: slide({ driver: "native" }) }).nativeSurgeryAllowed).toBe(true);
    // Blink composites the flight and rides main-thread stalls; a rewind there
    // would yank a smooth animation backwards.
    setEnv({ blink: true, touch: true });
    expect(route({ transition: slide({ driver: "native" }) }).nativeSurgeryAllowed).toBe(false);
  });
});

describe("the governed head kit", () => {
  it("covers touch WebKit, and carries that status's head length", () => {
    setEnv({ blink: false, touch: true });
    const push = route({ status: "PUSHING" });
    expect(push.touchGoverned).toBe(true);
    expect(push.governedHead).toBe(true);
    expect(push.birthHoldMs).toBeGreaterThan(0);
  });

  it("covers LEGACY touch Blink — no UA-CH brands — but not a modern one", () => {
    setEnv({ blink: true, touch: true, android: true, uaCh: false });
    expect(route().governedHead).toBe(true);
    setEnv({ blink: true, touch: true, android: true, uaCh: true });
    expect(route().governedHead).toBe(false);
  });

  it("falls back to a zero head for a status the tables do not size", () => {
    // Only the three animating statuses have head lengths. A drive run for any
    // other status must take 0 rather than NaN into every deadline.
    setEnv({ blink: false, touch: true });
    expect(route({ status: "COMPLETED" }).birthHoldMs).toBe(0);
    setEnv({ blink: false, touch: false, mac: true });
    expect(route({ status: "COMPLETED" }).desktopHead).toBe(true);
    expect(route({ status: "COMPLETED" }).birthHoldMs).toBe(0);
  });

  it("is off for desktop, on either engine", () => {
    setEnv({ blink: true, touch: false });
    expect(route().governedHead).toBe(false);
    setEnv({ blink: false, touch: false });
    expect(route().governedHead).toBe(false);
    expect(route().birthHoldMs).toBe(0);
  });

  it("arms the creep head only where the governed head is armed", () => {
    setEnv({ blink: false, touch: true });
    expect(route().creepHead).toBe(true); // default-on for touch WebKit
    sessionStorage.setItem("flemo:creep", "off");
    expect(route().creepHead).toBe(false);
    sessionStorage.setItem("flemo:creep", "on");
    setEnv({ blink: true, touch: false });
    expect(route().creepHead).toBe(false); // no governed head to creep from
  });
});

describe("forceCompiled", () => {
  it("takes POP always and PUSH only behind the settle gate", () => {
    setEnv({ blink: false, touch: true });
    expect(route({ status: "POPPING" }).forceCompiled).toBe(true);
    // Touch WebKit defaults the settle gate ON, so PUSH qualifies…
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(true);
    // …and stops qualifying the moment the gate is turned off, because the
    // mount weight is back in the release.
    sessionStorage.setItem("flemo:settle-gate", "off");
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(false);
    expect(route({ status: "POPPING" }).forceCompiled).toBe(true);
  });

  it("never applies to Blink", () => {
    setEnv({ blink: true, touch: true });
    expect(route({ status: "POPPING" }).forceCompiled).toBe(false);
  });
});

describe("desktopHead", () => {
  it("is desktop macOS Safari's own head, with its own lengths", () => {
    setEnv({ blink: false, touch: false, mac: true });
    const routing = route();
    expect(routing.desktopHead).toBe(true);
    expect(routing.governedHead).toBe(false);
    expect(routing.birthHoldMs).toBeGreaterThan(0);
  });

  it("yields to the governed head when both would apply", () => {
    // An iPad spoofing a Mac platform reports touch, so it takes the TOUCH
    // kit — the desktop head's lengths are sized for a different pipeline.
    setEnv({ blink: false, touch: true, mac: true });
    const routing = route();
    expect(routing.governedHead).toBe(true);
    expect(routing.desktopHead).toBe(false);
  });
});

describe("governedSlide", () => {
  it("is a slide on the governed touch tier, and covers a gate-off PUSH", () => {
    setEnv({ blink: false, touch: true });
    expect(route({ status: "PUSHING" }).governedSlide).toBe(true);
    expect(route({ status: "POPPING" }).governedSlide).toBe(true);
    // A cross-fade is not a slide.
    expect(route({ status: "REPLACING" }).governedSlide).toBe(false);
    // The case forceCompiled does not reach: the gate is off, so the PUSH is
    // no longer force-compiled, but the clock still must not be raced.
    sessionStorage.setItem("flemo:settle-gate", "off");
    const gateOff = route({ status: "PUSHING" });
    expect(gateOff.forceCompiled).toBe(false);
    expect(gateOff.governedSlide).toBe(true);
  });
});

describe("framePacingKeepalive", () => {
  it("is armed for desktop Blink, and for touch Blink only at high refresh", () => {
    setEnv({ blink: true, touch: false });
    expect(route().framePacingKeepalive).toBe(true);

    setEnv({ blink: true, touch: true });
    expect(route().framePacingKeepalive).toBe(false); // 60Hz seed: nothing to steady
    reportDisplayIntervalMs(1000 / 120);
    expect(route().framePacingKeepalive).toBe(true);
  });

  it("is never armed without an animation, or on WebKit", () => {
    setEnv({ blink: true, touch: false });
    expect(route({ hasAnimation: false }).framePacingKeepalive).toBe(false);
    setEnv({ blink: false, touch: false, mac: true });
    expect(route().framePacingKeepalive).toBe(false);
  });
});

describe("the routing as a whole", () => {
  it("takes the mobile-safe defaults with no navigator at all (SSR)", () => {
    const saved = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
    try {
      expect(route()).toEqual({
        hasDrivableMotion: true,
        nativeSurgeryAllowed: false,
        touchGoverned: false,
        forceCompiled: false,
        governedHead: false,
        desktopHead: false,
        birthHoldMs: 0,
        governedSlide: false,
        framePacingKeepalive: false,
        creepHead: false
      });
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: saved, configurable: true });
    }
  });

  it("is resolved fresh, so a DevTools toggle lands on the next flight", () => {
    setEnv({ blink: false, touch: true });
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(true);
    sessionStorage.setItem("flemo:settle-gate", "off");
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(false);
  });
});

// THE GAP THE BROWSER-AGE GATE LEAVES, made measurable.
//
// `isLegacyAndroidBlink` selects an old BROWSER. A modern-but-weak touch Blink
// — a 2022 foldable on a current Chrome — falls straight through it, and used
// to earn the kit through the driver demotion machinery that is now gone.
// Extending the kit to ALL touch Blink is the lever that was reverted on
// 2026-08-14 when fast devices picked up the compiled landing snap, so the
// answer is per-device measurement, and this key is how it is taken.
describe("the governed head kit's override", () => {
  const routeOn = (over: Parameters<typeof setEnv>[0]) => {
    setEnv(over);
    return resolveFlightRouting({
      status: "PUSHING",
      transition: { swipeDirection: "x" } as never,
      skipAnimation: false,
      hasActiveMotion: true,
      hasAnimation: true
    }).governedHead;
  };

  it("arms the kit on a modern touch Blink that would not earn it", () => {
    expect(routeOn({ blink: true, touch: true })).toBe(false);
    sessionStorage.setItem("flemo:governed", "on");
    expect(routeOn({ blink: true, touch: true })).toBe(true);
  });

  it("opts a legacy device back out", () => {
    expect(routeOn({ blink: true, touch: true, android: true, uaCh: false })).toBe(true);
    sessionStorage.setItem("flemo:governed", "off");
    expect(routeOn({ blink: true, touch: true, android: true, uaCh: false })).toBe(false);
  });

  it("never reaches a session that is not touch Blink", () => {
    sessionStorage.setItem("flemo:governed", "on");
    // Desktop Blink: no touch surface, so the kit is not its to take.
    expect(routeOn({ blink: true, touch: false })).toBe(false);
  });
});
