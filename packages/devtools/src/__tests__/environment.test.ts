import { afterEach, describe, expect, it, vi } from "vitest";

import { captureEnvironment, detectEngine, isEmulationSuspected } from "../environment";

import type { UaBrand } from "../types";

const stubNavigator = (overrides: {
  brands?: UaBrand[] | null;
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}) => {
  const base = {
    userAgent: overrides.userAgent ?? "",
    platform: overrides.platform ?? "",
    maxTouchPoints: overrides.maxTouchPoints ?? 0,
    ...(overrides.brands === null || overrides.brands === undefined
      ? {}
      : { userAgentData: { brands: overrides.brands } })
  };
  vi.stubGlobal("navigator", base);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const CHROMIUM_BRANDS: UaBrand[] = [
  { brand: "Chromium", version: "126" },
  { brand: "Google Chrome", version: "126" }
];

describe("detectEngine", () => {
  it("classifies a Chromium brand list as blink", () => {
    stubNavigator({ brands: CHROMIUM_BRANDS, platform: "MacIntel" });
    expect(detectEngine()).toBe("blink");
  });

  it("classifies UA-CH without a Chromium brand as webkit (2025 Safari ships userAgentData)", () => {
    stubNavigator({ brands: [{ brand: "Safari", version: "26" }], platform: "MacIntel" });
    expect(detectEngine()).toBe("webkit");
  });

  it("classifies Firefox as gecko", () => {
    stubNavigator({ userAgent: "Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/130.0" });
    expect(detectEngine()).toBe("gecko");
  });

  it("classifies brandless AppleWebKit UA as webkit", () => {
    stubNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Safari",
      platform: "iPhone"
    });
    expect(detectEngine()).toBe("webkit");
  });

  it("classifies brandless Android UA as blink (legacy Android ships no UA-CH)", () => {
    stubNavigator({
      userAgent: "Mozilla/5.0 (Linux; Android 10; SM-N960F) AppleWebKit/537.36 Chrome/80 Mobile",
      platform: "Linux armv8l",
      maxTouchPoints: 5
    });
    expect(detectEngine()).toBe("blink");
  });
});

describe("isEmulationSuspected", () => {
  it("flags Blink + Mac platform + touch points (the device-toolbar signature)", () => {
    stubNavigator({ brands: CHROMIUM_BRANDS, platform: "MacIntel", maxTouchPoints: 1 });
    expect(isEmulationSuspected()).toBe(true);
  });

  it("does not flag a plain desktop Blink window (no touch)", () => {
    stubNavigator({ brands: CHROMIUM_BRANDS, platform: "MacIntel", maxTouchPoints: 0 });
    expect(isEmulationSuspected()).toBe(false);
  });

  it("does not flag iPad WebKit (MacIntel + touch, but not Blink)", () => {
    stubNavigator({
      brands: [{ brand: "Safari", version: "26" }],
      platform: "MacIntel",
      maxTouchPoints: 5
    });
    expect(isEmulationSuspected()).toBe(false);
  });

  it("does not flag a real Android device (Linux armv8l)", () => {
    stubNavigator({
      brands: CHROMIUM_BRANDS,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile",
      platform: "Linux armv8l",
      maxTouchPoints: 5
    });
    expect(isEmulationSuspected()).toBe(false);
  });

  it("flags Android emulation on a desktop Linux platform", () => {
    stubNavigator({
      brands: CHROMIUM_BRANDS,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile",
      platform: "Linux x86_64",
      maxTouchPoints: 5
    });
    expect(isEmulationSuspected()).toBe(true);
  });
});

describe("captureEnvironment", () => {
  it("captures a serializable fingerprint with the given cadence", () => {
    stubNavigator({ brands: CHROMIUM_BRANDS, platform: "MacIntel", maxTouchPoints: 0 });
    const environment = captureEnvironment({ medianGapMs: 16.67, sampleCount: 20 });
    expect(environment.engine).toBe("blink");
    expect(environment.rafCadence).toEqual({ medianGapMs: 16.67, sampleCount: 20 });
    expect(environment.emulationSuspected).toBe(false);
    expect(typeof environment.devicePixelRatio).toBe("number");
    expect(typeof environment.observation.longTasks).toBe("boolean");
    expect(() => JSON.stringify(environment)).not.toThrow();
  });
});
