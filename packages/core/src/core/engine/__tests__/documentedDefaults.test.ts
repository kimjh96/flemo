import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readArrivalHoldFlag,
  readCreepHeadFlag,
  readDeferReleaseCommitFlag,
  readDesktopHeadFlag,
  readDesktopReleaseFlipFlag,
  readImageHoldFlag,
  readImageOffloadOverride,
  readRestLayerPromotionFlag,
  readPrerasterFlag,
  readSettleGateFlag,
  residentScreenLayers,
  resetResidentLayersForTesting
} from "@core/engine/diagnosticFlags";
import { reportInFlightCadence, resetSteadySixtyForTests } from "@platform/steadySixtyCadence";

// The registry table at the top of diagnosticFlags.ts is what every other reference
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
    // This session runs the wall-clocked compiled animation, which WebKit
    // presents from the main thread — so a heavy entering mount eats the
    // opening unless the release waits it out.
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

describe("documented defaults: the touch-WebKit opening set", () => {
  // One device round (a real iPhone, 2026-08-20/21) moved these from opt-in
  // probes to defaults, each with its own measured effect: the release
  // reconcile leaving the release frame (drops right after the release 61% →
  // 32% of pushes) and the creep head (drops at the head boundary 78% → 33%).
  // They are scoped to the tier they were measured on and every one keeps an
  // opt-out.
  //
  // The same round armed RESIDENT LAYERS and the scope's rest promotion; both
  // were reverted to opt-in on 2026-08-21 — a promotion that outlives the
  // flight is a permanent stacking context on the consumer's screen (see the
  // flemo:layers and REST-half cases below).
  it("are ON for touch WebKit", () => {
    setEnv({ blink: false, touch: true });
    expect(readCreepHeadFlag()).toBe(true);
    expect(readDeferReleaseCommitFlag()).toBe(true);
  });

  it("are OFF for Blink and for desktop WebKit", () => {
    // Blink composites the flight, so a main-thread commit never eats a
    // present there; the head these are shaped around is a touch-WebKit tier.
    setEnv({ blink: true, touch: true });
    expect(readCreepHeadFlag()).toBe(false);
    expect(readDeferReleaseCommitFlag()).toBe(false);
    setEnv({ blink: false, touch: false, mac: true });
    expect(readCreepHeadFlag()).toBe(false);
    expect(readDeferReleaseCommitFlag()).toBe(false);
  });

  it("each keep an explicit opt-out", () => {
    setEnv({ blink: false, touch: true });
    sessionStorage.setItem("flemo:creep", "off");
    sessionStorage.setItem("flemo:relcommit", "sync");
    expect(readCreepHeadFlag()).toBe(false);
    expect(readDeferReleaseCommitFlag()).toBe(false);
  });
});

describe("the touch-WebKit opening set: explicit values", () => {
  // Every default in the set is a production-default-with-override, so both
  // directions of the override are part of the contract, not decoration.
  it("honors an explicit value on each key", () => {
    setEnv({ blink: true, touch: true });
    sessionStorage.setItem("flemo:creep", "on");
    sessionStorage.setItem("flemo:relcommit", "defer");
    sessionStorage.setItem("flemo:deskhead", "on");
    expect(readCreepHeadFlag()).toBe(true);
    expect(readDeferReleaseCommitFlag()).toBe(true);
    expect(readDesktopHeadFlag()).toBe(true);
    sessionStorage.setItem("flemo:deskhead", "off");
    expect(readDesktopHeadFlag()).toBe(false);
  });

  it("keeps no screen layer resident by default, on any tier", () => {
    // Table: "off". A resident layer is a PERMANENT stacking context on the
    // screen scope, which silently outranks any consumer overlay inside it —
    // the tab-bar-over-bottom-sheet report. The tremor it removed is deferred
    // again (LAYER_SETTLE_MS) rather than skipped.
    for (const env of [
      { blink: false, touch: true }, // touch WebKit — the one-day default
      { blink: true, touch: true },
      { blink: true, touch: false, dpr: 2 },
      { blink: false, touch: false, mac: true }
    ]) {
      setEnv(env);
      resetResidentLayersForTesting();
      expect(residentScreenLayers()).toBe(false);
    }
  });

  it("still arms and disarms explicitly, so the experiment stays runnable", () => {
    setEnv({ blink: false, touch: true });
    resetResidentLayersForTesting();
    sessionStorage.setItem("flemo:layers", "resident");
    expect(residentScreenLayers()).toBe(true);

    resetResidentLayersForTesting();
    sessionStorage.setItem("flemo:layers", "off");
    expect(residentScreenLayers()).toBe(false);
  });
});

describe("documented default: flemo:imghold", () => {
  // Table: "off", opt-in. The steady-60 desktop default was retired 2026-08-21
  // (a desktop A/B judged it indistinguishable; a touch round measured a net
  // loss), so nothing turns the reader's null into a hold any more.
  it("reads as no-override until a value is set, profile or not", () => {
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

describe("documented default: the REST half of flemo:preraster", () => {
  // Table: "REST half: off". A promotion is also a stacking context, and at
  // rest it sits under the whole consumer screen for as long as the screen is
  // on top — a consumer overlay inside it can then never paint above the
  // shared bars. So no device profile earns this one; only the flag does.
  it("stays off for every tier the hold-window half is on for", () => {
    for (const env of [
      { blink: true, touch: false, dpr: 2 },
      { blink: false, touch: false, mac: true },
      { blink: false, touch: true }
    ]) {
      setEnv(env);
      expect(readRestLayerPromotionFlag()).toBe(false);
    }
  });

  it("is on only where the flag is armed", () => {
    setEnv({ blink: false, touch: true });
    sessionStorage.setItem("flemo:preraster", "on");
    expect(readRestLayerPromotionFlag()).toBe(true);
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
