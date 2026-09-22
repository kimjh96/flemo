import { afterEach, describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";

import type { Transition } from "@transition/typing";

import { resolveFlightRouting } from "@core/engine/flightRouting";
import { reportDisplayIntervalMs, resetDisplayCadenceForTests } from "@platform/displayCadence";
import { reportReleaseLatencyMs, resetReleaseLatencyForTests } from "@platform/releaseLatency";

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
    value: android ? "Mozilla/5.0 (Linux; Android 10; SM-N960N) AppleWebKit/537.36 Chrome/79" : "",
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
  resetReleaseLatencyForTests();
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
    expect(route().creepHead).toBe(true); // touch WebKit
    setEnv({ blink: true, touch: false });
    expect(route().creepHead).toBe(false); // no governed head to creep from
  });
});

describe("forceCompiled", () => {
  it("takes POP always and PUSH only behind the settle gate", () => {
    setEnv({ blink: false, touch: true });
    expect(route({ status: "POPPING" }).forceCompiled).toBe(true);
    // Touch WebKit arms the settle gate, so PUSH qualifies…
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(true);
    // …and a desktop non-Mac WebKit session, which the gate never reaches,
    // keeps POP and loses PUSH: the mount weight is back in the release.
    setEnv({ blink: false, touch: false });
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(false);
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

  it("covers a desktop Blink session too, which reaches glass no sooner", () => {
    // It was left out on the reading that the latency belonged to WebKit's
    // main-thread presentation. Traced on a 120Hz desktop Chrome, the
    // tap-to-first-painted-frame of a push ran 28.5ms against an 8.3ms frame,
    // and with no head that lands on the animation's opening.
    setEnv({ blink: true, touch: false });
    const routing = route();
    expect(routing.desktopHead).toBe(true);
    expect(routing.governedHead).toBe(false);
    expect(routing.birthHoldMs).toBeGreaterThan(0);
  });

  it("drops the head on a desktop Blink session whose opening is already a frame", () => {
    // A head is a cover for a latency, and a cover for a latency that is not
    // there is dead time: the screen held still after it could already have
    // moved. An app whose screens are already mounted reaches glass in a frame.
    setEnv({ blink: true, touch: false });
    reportReleaseLatencyMs("PUSHING", 4);
    const routing = route({ status: "PUSHING" });
    expect(routing.desktopHead).toBe(false);
    expect(routing.birthHoldMs).toBe(0);
  });

  it("keeps the head for the status that is still slow", () => {
    // The number is per status, because a push mounts a screen and a pop
    // reveals one that is already there.
    setEnv({ blink: true, touch: false });
    reportReleaseLatencyMs("PUSHING", 4);
    reportReleaseLatencyMs("POPPING", 30);
    expect(route({ status: "PUSHING" }).desktopHead).toBe(false);
    expect(route({ status: "POPPING" }).desktopHead).toBe(true);
  });

  it("keeps desktop Safari's head whatever the app measures", () => {
    // WebKit's latency is a property of how it presents, which no amount of
    // the app being fast removes.
    setEnv({ blink: false, touch: false, mac: true });
    reportReleaseLatencyMs("PUSHING", 1);
    expect(route({ status: "PUSHING" }).desktopHead).toBe(true);
  });

  it("leaves a TOUCH Blink session to the governed tier", () => {
    // A phone's head is sized for a governor-throttled pipeline, not a
    // desktop's, and a session is one or the other.
    setEnv({ blink: true, touch: true });
    expect(route().desktopHead).toBe(false);
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
  it("is a slide on the governed touch tier", () => {
    setEnv({ blink: false, touch: true });
    expect(route({ status: "PUSHING" }).governedSlide).toBe(true);
    expect(route({ status: "POPPING" }).governedSlide).toBe(true);
    // A cross-fade is not a slide.
    expect(route({ status: "REPLACING" }).governedSlide).toBe(false);
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

describe("landingClearFrames", () => {
  it("is one frame on Blink, which draws the last motion frame from the compositor", () => {
    setEnv({ blink: true, touch: false });
    expect(route().landingClearFrames).toBe(1);
    setEnv({ blink: true, touch: true });
    expect(route().landingClearFrames).toBe(1);
  });

  it("keeps WebKit's four, which presents from the main thread behind its commit", () => {
    setEnv({ blink: false, touch: false, mac: true });
    expect(route().landingClearFrames).toBe(4);
    setEnv({ blink: false, touch: true });
    expect(route().landingClearFrames).toBe(4);
  });

  it("does not vary with the status or the flight", () => {
    setEnv({ blink: true, touch: false });
    for (const status of ["PUSHING", "POPPING", "REPLACING"]) {
      expect(route({ status }).landingClearFrames).toBe(1);
    }
    expect(route({ hasAnimation: false }).landingClearFrames).toBe(1);
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
        creepHead: false,
        landingClearFrames: 4
      });
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: saved, configurable: true });
    }
  });

  it("is resolved fresh, so an environment change lands on the next flight", () => {
    setEnv({ blink: false, touch: true });
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(true);
    setEnv({ blink: true, touch: true });
    expect(route({ status: "PUSHING" }).forceCompiled).toBe(false);
  });
});

// The governed head kit on touch Blink follows browser AGE alone
// (isLegacyAndroidBlink). `flemo:governed` used to arm or disarm it per device
// — the gap being that a modern-but-weak phone, a 2022 foldable on a current
// Chrome, falls straight through the age probe. The key went with the rest of
// the diagnostic surface on 2026-08-31; extending the kit to ALL touch Blink
// remains the lever that was reverted on 2026-08-14 when fast devices picked up
// the compiled landing snap, so it stays age-gated.
describe("the governed head kit on touch Blink", () => {
  const routeOn = (over: Parameters<typeof setEnv>[0]) => {
    setEnv(over);
    return resolveFlightRouting({
      status: "PUSHING",
      transition: { swipe: { direction: "x" } } as never,
      skipAnimation: false,
      hasActiveMotion: true,
      hasAnimation: true
    }).governedHead;
  };

  it("follows the browser age", () => {
    expect(routeOn({ blink: true, touch: true })).toBe(false);
    expect(routeOn({ blink: true, touch: true, android: true, uaCh: false })).toBe(true);
  });

  it("never reaches a session that is not touch Blink", () => {
    // Desktop Blink: no touch surface, so the kit is not its to take.
    expect(routeOn({ blink: true, touch: false })).toBe(false);
  });
});
