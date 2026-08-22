import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readArrivalHoldFlag,
  readImageHoldFlag,
  readPrerasterFlag,
  readSettleGateFlag,
  resetResidentLayersForTesting,
  resetShallowFreezeForTesting,
  residentScreenLayers,
  shallowFreeze
} from "@core/engine/diagnosticFlags";

const NAV = navigator as { userAgentData?: unknown };

const FLAG_KEYS = [
  "flemo:imghold",
  "flemo:settle-gate",
  "flemo:arrivalhold",
  "flemo:layers",
  "flemo:freeze",
  "flemo:preraster"
];

const resetAllCaches = () => {
  resetResidentLayersForTesting();
  resetShallowFreezeForTesting();
};

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of FLAG_KEYS) sessionStorage.removeItem(key);
  resetAllCaches();
});

describe("uncached boolean flags", () => {
  it("default OFF and arm on their exact value", () => {
    expect(readImageHoldFlag()).toBe(null); // tri-state since 2026-08-18: "on" | "off" | null(default: steady-60 desktops hold unpainted-only)
    expect(readPrerasterFlag()).toBe(false);
    expect(readArrivalHoldFlag()).toBe(true); // default ON — the kill-switch is the opt-out
    sessionStorage.setItem("flemo:imghold", "on");
    sessionStorage.setItem("flemo:preraster", "on");
    sessionStorage.setItem("flemo:arrivalhold", "off");
    expect(readImageHoldFlag()).toBe("on");
    expect(readPrerasterFlag()).toBe(true);
    expect(readArrivalHoldFlag()).toBe(false);
  });

  it("ignore any other value", () => {
    sessionStorage.setItem("flemo:imghold", "true");
    expect(readImageHoldFlag()).toBe(null); // tri-state since 2026-08-18: "on" | "off" | null(default: steady-60 desktops hold unpainted-only)
  });

  it("are UNCACHED — a toggle takes effect on the next read", () => {
    expect(readPrerasterFlag()).toBe(false);
    sessionStorage.setItem("flemo:preraster", "on");
    expect(readPrerasterFlag()).toBe(true);
  });
});

describe("readSettleGateFlag defaults", () => {
  const asTouchBlink = () => {
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
  };

  afterEach(() => {
    delete NAV.userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    sessionStorage.removeItem("flemo:settle-gate");
  });

  // The pop-convergence round proved the gate on a Note 9 and wrote that into
  // ScreenMotion, but the default stayed WebKit-only — so every Android
  // session ran ungated while the code documented the opposite.
  it("is ON for touch Blink, the class it was validated on", () => {
    asTouchBlink();
    expect(readSettleGateFlag()).toBe(true);
  });

  it("stays OFF for desktop Blink with no verdict", () => {
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    expect(readSettleGateFlag()).toBe(false);
  });

  it("treats an engine without maxTouchPoints as non-touch", () => {
    // Older Chromium builds ship no maxTouchPoints at all; absent must read as
    // "not a touch device", never as a truthy value.
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    expect(readSettleGateFlag()).toBe(false);
  });

  it("still lets an explicit off win on the widened class", () => {
    asTouchBlink();
    sessionStorage.setItem("flemo:settle-gate", "off");
    expect(readSettleGateFlag()).toBe(false);
  });
});

describe("readSettleGateFlag", () => {
  it("honors on/off and defers to the tier default otherwise", () => {
    sessionStorage.setItem("flemo:settle-gate", "on");
    expect(readSettleGateFlag()).toBe(true);
    sessionStorage.setItem("flemo:settle-gate", "off");
    expect(readSettleGateFlag()).toBe(false);
    sessionStorage.removeItem("flemo:settle-gate");
    // jsdom is neither touch nor low-power WebKit: governedCompiledActive()
    // is false, so the unset default reads false here.
    expect(readSettleGateFlag()).toBe(false);
  });

  it("reads false — never the tier default — when storage throws", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("storage blocked");
      }
    });
    expect(readSettleGateFlag()).toBe(false);
  });
});

describe("URL-armed toggles (layers / freeze)", () => {
  it("read their armed values, cached per page load", () => {
    expect(residentScreenLayers()).toBe(false);
    expect(shallowFreeze()).toBe(false);
    sessionStorage.setItem("flemo:layers", "resident");
    sessionStorage.setItem("flemo:freeze", "shallow");
    expect(residentScreenLayers()).toBe(false); // cached
    expect(shallowFreeze()).toBe(false); // cached
    resetResidentLayersForTesting();
    resetShallowFreezeForTesting();
    expect(residentScreenLayers()).toBe(true);
    expect(shallowFreeze()).toBe(true);
  });
});

describe("storage degradation", () => {
  it("a runtime without sessionStorage reads every flag at its default", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(readImageHoldFlag()).toBe(null); // tri-state since 2026-08-18: "on" | "off" | null(default: steady-60 desktops hold unpainted-only)
    expect(readPrerasterFlag()).toBe(false);
    expect(readArrivalHoldFlag()).toBe(true);
    expect(readSettleGateFlag()).toBe(false);
    expect(residentScreenLayers()).toBe(false);
    expect(shallowFreeze()).toBe(false);
  });

  it("a storage that throws reads every flag at its default", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("storage blocked");
      }
    });
    expect(readImageHoldFlag()).toBe(null);
    expect(readArrivalHoldFlag()).toBe(true);
    expect(residentScreenLayers()).toBe(false);
    expect(shallowFreeze()).toBe(false);
  });
});
