import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readArrivalHoldFlag,
  readDesktopHeadFlag,
  readDesktopReleaseFlipFlag,
  readImageHoldFlag,
  readImageOffloadOverride,
  readLayerPromotionFlag,
  readPrerasterFlag,
  readSettleGateFlag,
  resetSessionOverrideCachesForTests
} from "@core/engine/diagnosticFlags";
import { reportInFlightCadence, resetSteadySixtyForTests } from "@core/engine/steadySixtyCadence";

// The registry table at the top of diagnosticFlags.ts is what docs/diagnostics.md
// delegates truth to, and it drifted from the code four keys at a time between
// 2026-08-17 and 08-19 — each time because a change updated the reader and one
// of the several prose copies of its default, but not the table. Every default
// that can be computed is asserted here, per environment, so a change to a
// default fails until the documented row matches it.
//
// Environments are named the way the table names them.

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
  resetSessionOverrideCachesForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete NAV.userAgentData;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  delete (navigator as unknown as Record<string, unknown>).platform;
  Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
  sessionStorage.clear();
  resetSteadySixtyForTests();
  resetSessionOverrideCachesForTests();
});

describe("documented default: flemo:settle-gate", () => {
  // Table: "touch WebKit + touch Blink + desktop macOS WebKit + steady-60 desktop".
  it("is ON for touch WebKit", () => {
    setEnv({ blink: false, touch: true });
    expect(readSettleGateFlag()).toBe(true);
  });

  it("is ON for touch Blink", () => {
    setEnv({ blink: true, touch: true });
    expect(readSettleGateFlag()).toBe(true);
  });

  it("is ON for a verified steady-60 HiDPI desktop", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    verifySteadySixty();
    expect(readSettleGateFlag()).toBe(true);
  });

  it("is ON for desktop macOS WebKit (Safari)", () => {
    // Gate 3 routes this session to the wall-clocked compiled tier, which
    // WebKit presents from the main thread — so a heavy entering mount eats
    // the opening unless the release waits it out.
    setEnv({ blink: false, touch: false, mac: true });
    expect(readSettleGateFlag()).toBe(true);
  });

  it("is OFF for desktop Blink with no verdict", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    expect(readSettleGateFlag()).toBe(false);
  });

  it("is OFF for desktop Blink on a Mac with no verdict", () => {
    // The Mac platform alone must not arm it: on Blink the compiled animation
    // is compositor-driven and rides main-thread stalls.
    setEnv({ blink: true, touch: false, dpr: 2, mac: true });
    expect(readSettleGateFlag()).toBe(false);
  });

  it("is OFF for a non-Mac desktop non-Blink session", () => {
    setEnv({ blink: false, touch: false });
    expect(readSettleGateFlag()).toBe(false);
  });

  it("still honors an explicit off on desktop macOS WebKit", () => {
    setEnv({ blink: false, touch: false, mac: true });
    sessionStorage.setItem("flemo:settle-gate", "off");
    expect(readSettleGateFlag()).toBe(false);
  });
});

describe("documented default: flemo:deskflip", () => {
  // Table: "desktop macOS WebKit". The flip reaches production through this
  // reader only — touch WebKit is armed by governedCompiledActive, and an
  // authored `driver: "native"` pin arms itself.
  it("is ON for desktop macOS WebKit (Safari)", () => {
    setEnv({ blink: false, touch: false, mac: true });
    expect(readDesktopReleaseFlipFlag()).toBe(true);
  });

  it("is OFF for touch WebKit, desktop Blink, and a non-Mac desktop", () => {
    setEnv({ blink: false, touch: true, mac: true });
    expect(readDesktopReleaseFlipFlag()).toBe(false);
    setEnv({ blink: true, touch: false, mac: true, dpr: 2 });
    expect(readDesktopReleaseFlipFlag()).toBe(false);
    setEnv({ blink: false, touch: false });
    expect(readDesktopReleaseFlipFlag()).toBe(false);
  });

  it("honors an explicit on/off in both directions", () => {
    setEnv({ blink: false, touch: false });
    sessionStorage.setItem("flemo:deskflip", "on");
    expect(readDesktopReleaseFlipFlag()).toBe(true);
    setEnv({ blink: false, touch: false, mac: true });
    sessionStorage.setItem("flemo:deskflip", "off");
    expect(readDesktopReleaseFlipFlag()).toBe(false);
  });
});

describe("documented default: flemo:deskhead", () => {
  // Table: "desktop macOS WebKit". Touch WebKit has its own head under a
  // different attribute with different lengths, so this key must not reach it.
  it("is ON for desktop macOS WebKit (Safari)", () => {
    setEnv({ blink: false, touch: false, mac: true });
    expect(readDesktopHeadFlag()).toBe(true);
  });

  it("is OFF for touch WebKit, desktop Blink, and a non-Mac desktop", () => {
    setEnv({ blink: false, touch: true, mac: true });
    expect(readDesktopHeadFlag()).toBe(false);
    setEnv({ blink: true, touch: false, mac: true, dpr: 2 });
    expect(readDesktopHeadFlag()).toBe(false);
    setEnv({ blink: false, touch: false });
    expect(readDesktopHeadFlag()).toBe(false);
  });

  it("honors an explicit off — the A/B against the birth anchor", () => {
    setEnv({ blink: false, touch: false, mac: true });
    sessionStorage.setItem("flemo:deskhead", "off");
    expect(readDesktopHeadFlag()).toBe(false);
  });
});

describe("documented default: flemo:imghold", () => {
  // Table: "unpainted-only on steady-60 desktop, else off". The reader returns
  // null for "no override" — the engine turns that into the unpainted-only hold
  // when the profile qualifies, so the tri-state IS the documented default.
  it("reads as no-override until a value is set", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    verifySteadySixty();
    expect(readImageHoldFlag()).toBeNull();
  });

  it("honors an explicit on/off", () => {
    sessionStorage.setItem("flemo:imghold", "on");
    expect(readImageHoldFlag()).toBe("on");
    sessionStorage.setItem("flemo:imghold", "off");
    expect(readImageHoldFlag()).toBe("off");
  });
});

describe("documented default: flemo:arrivalhold", () => {
  // Table: default ON — the row that was missing from the table entirely.
  it("is ON with nothing set, and only an explicit off disables it", () => {
    expect(readArrivalHoldFlag()).toBe(true);
    sessionStorage.setItem("flemo:arrivalhold", "off");
    expect(readArrivalHoldFlag()).toBe(false);
  });
});

describe("documented default: flemo:preraster", () => {
  // Table: the FLAG itself is off by default (its rest-promotion half is
  // default-on for steady-60 desktop, which lives in the binding, not here).
  it("is off until explicitly armed", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    verifySteadySixty();
    expect(readPrerasterFlag()).toBe(false);
    sessionStorage.setItem("flemo:preraster", "on");
    expect(readPrerasterFlag()).toBe(true);
  });
});

describe("documented default: the flemo:preraster layer-promotion half", () => {
  // Table: the screen-scope promotion is armed by the flag on ANY device and is
  // DEFAULT-ON for the steady-60 desktop profile. Every term is browser-only
  // state, which is why the react binding may only apply it after hydration —
  // the contract is asserted in react's ScreenMotion.hydration.test.tsx.
  it("is off on a desktop Blink session with no verdict and no flag", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    expect(readLayerPromotionFlag()).toBe(false);
  });

  it("is on for a verified steady-60 HiDPI desktop", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    verifySteadySixty();
    expect(readLayerPromotionFlag()).toBe(true);
  });

  it("is on wherever the flag is armed, whatever the device profile", () => {
    setEnv({ blink: false, touch: true });
    sessionStorage.setItem("flemo:preraster", "on");
    expect(readLayerPromotionFlag()).toBe(true);
  });
});

describe("documented default: flemo:imgoffload", () => {
  // Table: "auto (legacy Android Blink)" — the reader reports the OVERRIDE
  // only; auto is the absence of one.
  it("reports no override until set, then reports it verbatim", () => {
    setEnv({ blink: true, touch: true, android: true, uaCh: false });
    expect(readImageOffloadOverride()).toBeNull();
    sessionStorage.setItem("flemo:imgoffload", "off");
    expect(readImageOffloadOverride()).toBe("off");
  });
});
