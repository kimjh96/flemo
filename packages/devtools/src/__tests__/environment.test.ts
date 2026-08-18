import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureEnvironment,
  detectEngine,
  isEmulationSuspected,
  sampleRafCadence
} from "../environment";

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

describe("detectEngine edge cases", () => {
  it("returns unknown without a navigator at all", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectEngine()).toBe("unknown");
    expect(isEmulationSuspected()).toBe(false);
  });

  it("returns unknown for a brandless, unrecognizable UA", () => {
    stubNavigator({ userAgent: "SomeBot/1.0", platform: "Unknown" });
    expect(detectEngine()).toBe("unknown");
  });
});

describe("sampleRafCadence", () => {
  it("samples a median idle gap where rAF exists", async () => {
    const cadence = await sampleRafCadence(5);
    expect(cadence.sampleCount).toBe(5);
    expect(cadence.medianGapMs).toBeGreaterThan(0);
  });

  it("resolves null where rAF is unavailable", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    const cadence = await sampleRafCadence(5);
    expect(cadence).toEqual({ medianGapMs: null, sampleCount: 0 });
  });

  it("clamps a non-positive sample count instead of resolving NaN", async () => {
    const cadence = await sampleRafCadence(0);
    expect(cadence.sampleCount).toBe(1);
    expect(Number.isFinite(cadence.medianGapMs)).toBe(true);
    const negative = await sampleRafCadence(-3);
    expect(negative.sampleCount).toBe(1);
    expect(Number.isFinite(negative.medianGapMs)).toBe(true);
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

  it("degrades gracefully without a navigator", () => {
    vi.stubGlobal("navigator", undefined);
    const environment = captureEnvironment({ medianGapMs: null, sampleCount: 0 });
    expect(environment.userAgent).toBe("");
    expect(environment.uaBrands).toBeNull();
    expect(environment.engine).toBe("unknown");
    expect(environment.maxTouchPoints).toBe(0);
  });

  it("reads the visualViewport scale when present", () => {
    stubNavigator({ brands: CHROMIUM_BRANDS, platform: "MacIntel" });
    (window as unknown as { visualViewport?: { scale: number } }).visualViewport = { scale: 2 };
    const environment = captureEnvironment({ medianGapMs: null, sampleCount: 0 });
    expect(environment.visualViewportScale).toBe(2);
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  });

  it("treats a throwing matchMedia as no reduced-motion preference", () => {
    stubNavigator({ brands: CHROMIUM_BRANDS, platform: "MacIntel" });
    (window as unknown as { matchMedia: () => never }).matchMedia = () => {
      throw new Error("blocked");
    };
    const environment = captureEnvironment({ medianGapMs: null, sampleCount: 0 });
    expect(environment.reducedMotion).toBe(false);
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it("treats a throwing PerformanceObserver probe as longtask-unobservable", () => {
    stubNavigator({ brands: CHROMIUM_BRANDS, platform: "MacIntel" });
    vi.stubGlobal(
      "PerformanceObserver",
      new Proxy(class {}, {
        get() {
          throw new Error("blocked");
        }
      })
    );
    const environment = captureEnvironment({ medianGapMs: null, sampleCount: 0 });
    expect(environment.observation.longTasks).toBe(false);
  });
});
