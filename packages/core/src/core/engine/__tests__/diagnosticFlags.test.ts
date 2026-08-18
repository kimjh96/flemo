import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HANDOFF_MS_DEFAULT,
  JITTER_BAND_MAX_DEVICE_PX,
  handoffMs,
  handoffOverride,
  jitterBandMaxDevicePx,
  readHandoffFlag,
  readImageHoldFlag,
  readImageOffloadOverride,
  readLandingSnapFlag,
  readPrerasterFlag,
  readSettleGateFlag,
  resetResidentLayersForTesting,
  resetSessionOverrideCachesForTests,
  resetShallowFreezeForTesting,
  residentScreenLayers,
  shallowFreeze,
  snapOverride,
  snapshotApplyOverride
} from "@core/engine/diagnosticFlags";

const FLAG_KEYS = [
  "flemo:landing-snap",
  "flemo:imghold",
  "flemo:settle-gate",
  "flemo:handoff",
  "flemo:handoffms",
  "flemo:apply",
  "flemo:snap",
  "flemo:snapband",
  "flemo:layers",
  "flemo:freeze",
  "flemo:preraster",
  "flemo:imgoffload"
];

const resetAllCaches = () => {
  resetSessionOverrideCachesForTests();
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
    expect(readLandingSnapFlag()).toBe(false);
    expect(readImageHoldFlag()).toBe(null); // tri-state since 2026-08-18: "on" | "off" | null(default: steady-60 desktops hold unpainted-only)
    expect(readHandoffFlag()).toBe(false);
    expect(readPrerasterFlag()).toBe(false);
    sessionStorage.setItem("flemo:landing-snap", "on");
    sessionStorage.setItem("flemo:imghold", "on");
    sessionStorage.setItem("flemo:handoff", "on");
    sessionStorage.setItem("flemo:preraster", "on");
    expect(readLandingSnapFlag()).toBe(true);
    expect(readImageHoldFlag()).toBe("on");
    expect(readHandoffFlag()).toBe(true);
    expect(readPrerasterFlag()).toBe(true);
  });

  it("ignore any other value", () => {
    sessionStorage.setItem("flemo:imghold", "true");
    expect(readImageHoldFlag()).toBe(null); // tri-state since 2026-08-18: "on" | "off" | null(default: steady-60 desktops hold unpainted-only)
  });

  it("are UNCACHED — a toggle takes effect on the next read", () => {
    expect(readHandoffFlag()).toBe(false);
    sessionStorage.setItem("flemo:handoff", "on");
    expect(readHandoffFlag()).toBe(true);
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

describe("readImageOffloadOverride", () => {
  it("returns on/off verbatim and null for anything else", () => {
    expect(readImageOffloadOverride()).toBe(null);
    sessionStorage.setItem("flemo:imgoffload", "on");
    expect(readImageOffloadOverride()).toBe("on");
    sessionStorage.setItem("flemo:imgoffload", "off");
    expect(readImageOffloadOverride()).toBe("off");
    sessionStorage.setItem("flemo:imgoffload", "auto");
    expect(readImageOffloadOverride()).toBe(null);
  });
});

describe("cached session overrides", () => {
  it("validate their value sets and fall back to null/defaults", () => {
    sessionStorage.setItem("flemo:apply", "scrub");
    sessionStorage.setItem("flemo:snap", "hybrid");
    expect(snapshotApplyOverride()).toBe("scrub");
    expect(snapOverride()).toBe("hybrid");
    resetAllCaches();
    sessionStorage.setItem("flemo:apply", "waapi");
    sessionStorage.setItem("flemo:snap", "sometimes");
    expect(snapshotApplyOverride()).toBe(null);
    expect(snapOverride()).toBe(null);
  });

  it("parse the numeric overrides and reject non-positive/garbage values", () => {
    expect(jitterBandMaxDevicePx()).toBe(JITTER_BAND_MAX_DEVICE_PX);
    expect(handoffMs()).toBe(HANDOFF_MS_DEFAULT);
    resetAllCaches();
    sessionStorage.setItem("flemo:snapband", "2.5");
    sessionStorage.setItem("flemo:handoffms", "0");
    expect(jitterBandMaxDevicePx()).toBe(2.5);
    expect(handoffMs()).toBe(0); // zero is a legal handoff point…
    resetAllCaches();
    sessionStorage.setItem("flemo:snapband", "0"); // …but not a legal band width
    sessionStorage.setItem("flemo:handoffms", "-1");
    expect(jitterBandMaxDevicePx()).toBe(JITTER_BAND_MAX_DEVICE_PX);
    expect(handoffMs()).toBe(HANDOFF_MS_DEFAULT);
    resetAllCaches();
    sessionStorage.setItem("flemo:snapband", "fast");
    sessionStorage.setItem("flemo:handoffms", "soon");
    expect(jitterBandMaxDevicePx()).toBe(JITTER_BAND_MAX_DEVICE_PX);
    expect(handoffMs()).toBe(HANDOFF_MS_DEFAULT);
  });

  it("read once per page load — a mid-session toggle needs the test reset", () => {
    sessionStorage.setItem("flemo:snap", "always");
    expect(snapOverride()).toBe("always");
    sessionStorage.setItem("flemo:snap", "off");
    expect(snapOverride()).toBe("always"); // cached
    resetSessionOverrideCachesForTests();
    expect(snapOverride()).toBe("off");
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
    expect(readLandingSnapFlag()).toBe(false);
    expect(readImageHoldFlag()).toBe(null); // tri-state since 2026-08-18: "on" | "off" | null(default: steady-60 desktops hold unpainted-only)
    expect(readHandoffFlag()).toBe(false);
    expect(readPrerasterFlag()).toBe(false);
    expect(readSettleGateFlag()).toBe(false);
    expect(readImageOffloadOverride()).toBe(null);
    expect(snapshotApplyOverride()).toBe(null);
    expect(snapOverride()).toBe(null);
    expect(handoffOverride()).toBe(null);
    expect(jitterBandMaxDevicePx()).toBe(JITTER_BAND_MAX_DEVICE_PX);
    expect(handoffMs()).toBe(HANDOFF_MS_DEFAULT);
    expect(residentScreenLayers()).toBe(false);
    expect(shallowFreeze()).toBe(false);
  });

  it("a storage that throws reads every flag at its default", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("storage blocked");
      }
    });
    expect(readLandingSnapFlag()).toBe(false);
    expect(readImageOffloadOverride()).toBe(null);
    expect(snapOverride()).toBe(null);
    expect(handoffOverride()).toBe(null);
    expect(jitterBandMaxDevicePx()).toBe(JITTER_BAND_MAX_DEVICE_PX);
    expect(handoffMs()).toBe(HANDOFF_MS_DEFAULT);
    expect(residentScreenLayers()).toBe(false);
    expect(shallowFreeze()).toBe(false);
  });
});

// URL arming (?flemo-settle= / ?flemo-driver=). The module syncs at LOAD, so
// each case re-imports with the search string already in place — the same
// shape the shipped instruments use, and the reason a phone no longer needs a
// desktop debugger attached to run an A/B.
describe("device URL arming", () => {
  const withSearch = async (search: string) => {
    vi.stubGlobal("location", { search } as unknown as Location);
    vi.resetModules();
    return import("@core/engine/diagnosticFlags");
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    sessionStorage.clear();
  });

  it("arms and clears the settle gate", async () => {
    await withSearch("?flemo-settle=on");
    expect(sessionStorage.getItem("flemo:settle-gate")).toBe("on");

    await withSearch("?flemo-settle=off");
    expect(sessionStorage.getItem("flemo:settle-gate")).toBe("off");

    // "auto" returns the key to the platform default rather than pinning it.
    await withSearch("?flemo-settle=auto");
    expect(sessionStorage.getItem("flemo:settle-gate")).toBeNull();
  });

  it("stamps the driver pin so driverPolicy honors it, and clears on off", async () => {
    await withSearch("?flemo-driver=css");
    const pinned = sessionStorage.getItem("flemo:motion-driver-force") ?? "";
    const [driver, stamp] = pinned.split("@");
    expect(driver).toBe("css");
    // An unstamped pin is stripped on sight by driverPolicy — the URL form
    // must carry a fresh timestamp or it would be silently dropped.
    expect(Number.isFinite(Number(stamp))).toBe(true);
    expect(Math.abs(Date.now() - Number(stamp))).toBeLessThan(60_000);

    await withSearch("?flemo-driver=off");
    expect(sessionStorage.getItem("flemo:motion-driver-force")).toBeNull();
  });

  it("ignores an unrelated or malformed query", async () => {
    sessionStorage.setItem("flemo:settle-gate", "on");
    await withSearch("?flemo-settle=maybe&flemo-driver=turbo&page=2");
    expect(sessionStorage.getItem("flemo:settle-gate")).toBe("on");
    expect(sessionStorage.getItem("flemo:motion-driver-force")).toBeNull();
  });

  it("stays inert where storage or location is unavailable", async () => {
    vi.stubGlobal("sessionStorage", undefined);
    vi.stubGlobal("location", { search: "?flemo-settle=on" } as unknown as Location);
    vi.resetModules();
    await expect(import("@core/engine/diagnosticFlags")).resolves.toBeDefined();
  });
});
