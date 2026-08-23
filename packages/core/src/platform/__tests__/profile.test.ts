import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolvePlatformProfile, restLayerPromotionEnabled } from "@platform/profile";
import { reportInFlightCadence, resetSteadySixtyForTests } from "@platform/steadySixtyCadence";

// The platform profile is the ONE place a per-browser decision is made, so
// these suites are the contract between core and every binding: an environment
// in, a set of named decisions out.
//
// They double as the regression net for the drift the profile was built to end
// — the binding deriving policy that core disagreed with. If a field's rule
// changes, it changes here, once.

const NAV = navigator as { userAgentData?: unknown };
let originalDpr: number;

const setEnv = (over: {
  blink?: boolean;
  touch?: boolean;
  mac?: boolean;
  android?: boolean;
  uaCh?: boolean;
  dpr?: number;
}) => {
  const { blink = false, touch = false, mac = false, android = false, uaCh = true, dpr = 1 } = over;
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
  Object.defineProperty(window, "devicePixelRatio", { value: dpr, configurable: true });
};

beforeEach(() => {
  originalDpr = window.devicePixelRatio;
  resetSteadySixtyForTests();
});

afterEach(() => {
  delete NAV.userAgentData;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  delete (navigator as unknown as Record<string, unknown>).platform;
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
  sessionStorage.clear();
  resetSteadySixtyForTests();
});

describe("mainThreadPresented", () => {
  it("is the inverse of the Blink probe — the fact every opening treatment follows from", () => {
    setEnv({ blink: true, touch: true });
    expect(resolvePlatformProfile().mainThreadPresented).toBe(false);
    setEnv({ blink: false, touch: true });
    expect(resolvePlatformProfile().mainThreadPresented).toBe(true);
  });
});

describe("atomicReleaseFlip", () => {
  it("is on for touch WebKit and desktop macOS Safari", () => {
    setEnv({ blink: false, touch: true });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(true);
    setEnv({ blink: false, touch: false, mac: true });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(true);
  });

  it("is NEVER on for Blink, whatever else asks for it", () => {
    // Blink's compiled animation is compositor-driven and rides a main-thread
    // gap without aging, so the flip buys it nothing — and an authored pin must
    // not smuggle it in either.
    setEnv({ blink: true, touch: true });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(false);
    expect(resolvePlatformProfile({ authoredNativeDriver: true }).atomicReleaseFlip).toBe(false);
    sessionStorage.setItem("flemo:deskflip", "on");
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(false);
  });

  it("is off for a plain non-Mac desktop non-Blink session unless a transition pins native", () => {
    setEnv({ blink: false, touch: false });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(false);
    expect(resolvePlatformProfile({ authoredNativeDriver: true }).atomicReleaseFlip).toBe(true);
  });

  it("honors an explicit deskflip override in both directions", () => {
    setEnv({ blink: false, touch: false, mac: true });
    sessionStorage.setItem("flemo:deskflip", "off");
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(false);
    setEnv({ blink: false, touch: false });
    sessionStorage.setItem("flemo:deskflip", "on");
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(true);
  });
});

describe("renderSettleGate", () => {
  it("is on for touch WebKit, touch Blink, desktop macOS Safari and a verified steady-60 desktop", () => {
    setEnv({ blink: false, touch: true });
    expect(resolvePlatformProfile().renderSettleGate).toBe(true);
    setEnv({ blink: true, touch: true });
    expect(resolvePlatformProfile().renderSettleGate).toBe(true);
    setEnv({ blink: false, touch: false, mac: true });
    expect(resolvePlatformProfile().renderSettleGate).toBe(true);

    setEnv({ blink: true, touch: false, dpr: 2 });
    expect(resolvePlatformProfile().renderSettleGate).toBe(false);
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    expect(resolvePlatformProfile().renderSettleGate).toBe(true);
  });
});

describe("parkOver", () => {
  it("is on for touch WebKit, and elsewhere only when the preraster flag arms it", () => {
    setEnv({ blink: false, touch: true });
    expect(resolvePlatformProfile().parkOver).toBe(true);
    setEnv({ blink: true, touch: true });
    expect(resolvePlatformProfile().parkOver).toBe(false);
    sessionStorage.setItem("flemo:preraster", "on");
    expect(resolvePlatformProfile().parkOver).toBe(true);
  });
});

describe("restLayerPromotion", () => {
  it("is off on every tier by default — a resting promotion is a stacking context", () => {
    for (const env of [
      { blink: false, touch: true },
      { blink: true, touch: true },
      { blink: true, touch: false, dpr: 2 },
      { blink: false, touch: false, mac: true }
    ]) {
      setEnv(env);
      expect(resolvePlatformProfile().restLayerPromotion).toBe(false);
    }
  });

  it("exposes the same decision as a module-stable reader for hydration-gated bindings", () => {
    setEnv({ blink: false, touch: true });
    expect(restLayerPromotionEnabled()).toBe(resolvePlatformProfile().restLayerPromotion);
    sessionStorage.setItem("flemo:preraster", "on");
    expect(restLayerPromotionEnabled()).toBe(true);
    // The identity must be stable: React's useSyncExternalStore resubscribes
    // when the reader changes, which an inline lambda would do every render.
    expect(restLayerPromotionEnabled).toBe(restLayerPromotionEnabled);
  });
});

describe("imageDecodeOffload", () => {
  // The cost this removes is created by the IMAGE, not the browser: a 48px
  // avatar holding a 37-megapixel original is expensive to decode wherever it
  // lands. It used to be armed by a browser-age probe, which let a 2022 phone
  // on a current Chrome through — device-measured as a janking push, smooth
  // with the offloader, judged in both directions. The offloader already makes
  // the decision that matters, per image and from the source's own bytes.
  it("is on for every browser — the offloader decides per image", () => {
    for (const env of [
      { blink: true, touch: true, android: true, uaCh: false },
      { blink: true, touch: true, android: true, uaCh: true },
      { blink: false, touch: true },
      { blink: true, touch: false },
      { blink: false, touch: false, mac: true }
    ]) {
      setEnv(env);
      expect(resolvePlatformProfile().imageDecodeOffload, JSON.stringify(env)).toBe(true);
    }
  });

  it("honors the override both ways", () => {
    setEnv({ blink: false, touch: true });
    sessionStorage.setItem("flemo:imgoffload", "on");
    expect(resolvePlatformProfile().imageDecodeOffload).toBe(true);
    setEnv({ blink: true, touch: true, android: true, uaCh: false });
    sessionStorage.setItem("flemo:imgoffload", "off");
    expect(resolvePlatformProfile().imageDecodeOffload).toBe(false);
  });
});

describe("the profile as a whole", () => {
  it("is resolved fresh on every call, so a DevTools toggle lands on the next navigation", () => {
    setEnv({ blink: false, touch: false, mac: true });
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(true);
    sessionStorage.setItem("flemo:deskflip", "off");
    // No reset, no reload: the very next resolve sees it.
    expect(resolvePlatformProfile().atomicReleaseFlip).toBe(false);
  });

  it("answers every documented field for an environment with no navigator at all (SSR)", () => {
    const saved = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
    try {
      const profile = resolvePlatformProfile();
      // SSR takes the mobile-safe defaults: nothing is verified, so nothing
      // that changes motion is armed.
      expect(profile).toEqual({
        mainThreadPresented: true,
        atomicReleaseFlip: false,
        deferReleaseCommit: false,
        renderSettleGate: false,
        parkOver: false,
        restLayerPromotion: false,
        imageDecodeOffload: false
      });
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: saved, configurable: true });
    }
  });
});
