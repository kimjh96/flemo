import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolvePlatformProfile, settleGateActive } from "@platform/profile";
import { reportInFlightCadence, resetSteadySixtyForTests } from "@platform/steadySixtyCadence";

// EVERY PER-BROWSER DECISION, ASSERTED PER ENVIRONMENT.
//
// Each of these was a `flemo:*` session key with a computed default and an
// override in both directions, and the defaults drifted from their own prose
// four keys at a time between 2026-08-17 and 08-19. The keys were removed on
// 2026-08-31 — a diagnostic surface has no business shipping to consumers —
// which leaves the computed default as the WHOLE behavior. There is no longer
// an override to fall back on if one of these is wrong, so the environments
// each decision claims are pinned here.

const NAV = navigator as { userAgentData?: unknown };
let originalDpr: number;

const setEnv = (over: {
  blink?: boolean;
  touch?: boolean;
  dpr?: number;
  android?: boolean;
  uaCh?: boolean;
  mac?: boolean;
}) => {
  const { blink = false, touch = false, dpr = 1, android = false, uaCh = true, mac = false } = over;
  if (blink && uaCh) NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
  else delete NAV.userAgentData;
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch ? 5 : 0, configurable: true });
  // jsdom reports an empty platform, which is what keeps a default suite off
  // the desktop-Safari terms; the Mac platform is opt-in per environment.
  Object.defineProperty(navigator, "platform", {
    value: mac ? "MacIntel" : "",
    configurable: true
  });
  Object.defineProperty(navigator, "userAgent", {
    value: android ? "Mozilla/5.0 (Linux; Android 10; SM-N960N) AppleWebKit/537.36 Chrome/120" : "",
    configurable: true
  });
  Object.defineProperty(window, "devicePixelRatio", { value: dpr, configurable: true });
};

/** Two qualifying in-flight medians: what the steady-60 verdict needs. */
const verifySteadySixty = () => {
  reportInFlightCadence(16.7);
  reportInFlightCadence(16.7);
};

beforeEach(() => {
  originalDpr = window.devicePixelRatio;
  resetSteadySixtyForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete NAV.userAgentData;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  delete (navigator as unknown as Record<string, unknown>).platform;
  Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
  resetSteadySixtyForTests();
});

describe("the render-settle gate", () => {
  // Touch WebKit + touch Blink + desktop macOS WebKit + steady-60 desktop.
  it("is ON for touch WebKit", () => {
    setEnv({ blink: false, touch: true });
    expect(settleGateActive()).toBe(true);
  });

  it("is ON for touch Blink", () => {
    setEnv({ blink: true, touch: true });
    expect(settleGateActive()).toBe(true);
  });

  it("is ON for a verified steady-60 HiDPI desktop", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    verifySteadySixty();
    expect(settleGateActive()).toBe(true);
  });

  it("is ON for desktop macOS WebKit (Safari)", () => {
    // This session runs the wall-clocked compiled animation, which WebKit
    // presents from the main thread — so a heavy entering mount eats the
    // opening unless the release waits it out.
    setEnv({ blink: false, touch: false, mac: true });
    expect(settleGateActive()).toBe(true);
  });

  it("is OFF for desktop Blink with no verdict", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    expect(settleGateActive()).toBe(false);
  });

  it("is OFF for desktop Blink on a Mac with no verdict", () => {
    // The Mac platform alone must not arm it: on Blink the compiled animation
    // is compositor-driven and rides main-thread stalls.
    setEnv({ blink: true, touch: false, dpr: 2, mac: true });
    expect(settleGateActive()).toBe(false);
  });

  it("is OFF for a non-Mac desktop non-Blink session", () => {
    setEnv({ blink: false, touch: false });
    expect(settleGateActive()).toBe(false);
  });

  it("is published on the profile as renderSettleGate", () => {
    setEnv({ blink: false, touch: true });
    expect(resolvePlatformProfile().renderSettleGate).toBe(true);
    setEnv({ blink: true, touch: false, dpr: 2 });
    expect(resolvePlatformProfile().renderSettleGate).toBe(false);
  });
});

describe("the atomic release flip", () => {
  // Desktop macOS WebKit and touch WebKit, plus any authored `driver:
  // "native"` pin. Blink is excluded by mainThreadPresented: its compiled
  // animation is compositor-driven and rides a main-thread gap without aging.
  it("is ON for desktop macOS WebKit (Safari)", () => {
    setEnv({ blink: false, touch: false, mac: true });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(true);
  });

  it("is ON for touch WebKit", () => {
    setEnv({ blink: false, touch: true });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(true);
  });

  it("is OFF for desktop Blink and for a non-Mac desktop non-Blink session", () => {
    setEnv({ blink: true, touch: false, mac: true, dpr: 2 });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(false);
    setEnv({ blink: false, touch: false });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(false);
  });

  it("an authored native driver takes it on any non-Blink session", () => {
    setEnv({ blink: false, touch: false });
    expect(resolvePlatformProfile({ authoredNativeDriver: true }).atomicReleaseFlip).toBe(true);
    setEnv({ blink: true, touch: false, dpr: 2 });
    expect(resolvePlatformProfile({ authoredNativeDriver: true }).atomicReleaseFlip).toBe(false);
  });
});

describe("the touch-WebKit opening set", () => {
  // One device round (a real iPhone, 2026-08-20/21) moved these from opt-in
  // probes to defaults, each with its own measured effect: the release
  // reconcile leaving the release frame (drops right after the release 61% ->
  // 32% of pushes) and the park-over hold painting the entering tiles during
  // the hold. They are scoped to the tier they were measured on.
  it("are ON for touch WebKit", () => {
    setEnv({ blink: false, touch: true });
    const profile = resolvePlatformProfile();
    expect(profile.deferReleaseCommit).toBe(true);
    expect(profile.parkOver).toBe(true);
  });

  it("are OFF for Blink and for desktop WebKit", () => {
    // Blink composites the flight, so a main-thread commit never eats a
    // present there; the head these are shaped around is a touch-WebKit tier.
    setEnv({ blink: true, touch: true });
    let profile = resolvePlatformProfile();
    expect(profile.deferReleaseCommit).toBe(false);
    expect(profile.parkOver).toBe(false);
    setEnv({ blink: false, touch: false, mac: true });
    profile = resolvePlatformProfile();
    expect(profile.deferReleaseCommit).toBe(false);
    expect(profile.parkOver).toBe(false);
  });
});

describe("the image decode offloader", () => {
  // THE IMAGE DECIDES, NOT THE DEVICE: the offloader only touches a source
  // carrying more than OVERSIZE_AREA_RATIO times its display area, so it is
  // armed wherever there is a browser at all. The device gate was removed on
  // 2026-08-23 after a Galaxy Z Flip 4 — a phone the browser-age probe
  // excluded — janked without it and was smooth with it.
  it("is ON wherever there is a navigator", () => {
    for (const env of [
      { blink: false, touch: true },
      { blink: true, touch: true, android: true },
      { blink: true, touch: false, dpr: 2 },
      { blink: false, touch: false, mac: true }
    ]) {
      setEnv(env);
      expect(resolvePlatformProfile().imageDecodeOffload).toBe(true);
    }
  });
});
