import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readArrivalHoldFlag,
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
}) => {
  const { blink = false, touch = false, dpr = 1, android = false, uaCh = true } = over;
  if (blink && uaCh) NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
  else delete NAV.userAgentData;
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch ? 5 : 0, configurable: true });
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
  Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
  sessionStorage.clear();
  resetSteadySixtyForTests();
  resetSessionOverrideCachesForTests();
});

describe("documented default: flemo:settle-gate", () => {
  // Table: "touch WebKit + touch Blink + steady-60 desktop".
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

  it("is OFF for desktop Blink with no verdict", () => {
    setEnv({ blink: true, touch: false, dpr: 2 });
    expect(readSettleGateFlag()).toBe(false);
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
