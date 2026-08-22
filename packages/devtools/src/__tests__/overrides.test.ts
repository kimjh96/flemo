import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deriveOverrideWarnings,
  FLAG_REGISTRY,
  LEGACY_LOCAL_PIN_KEY,
  snapshotOverrides
} from "../overrides";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe("FLAG_REGISTRY", () => {
  it("documents every key from the core diagnostic-flag table", () => {
    const keys = FLAG_REGISTRY.map((flag) => flag.key);
    for (const expected of [
      "flemo:motion-driver",
      "flemo:motion-driver-force",
      "flemo:lat",
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
    ]) {
      expect(keys).toContain(expected);
    }
  });
});

describe("snapshotOverrides", () => {
  it("returns an empty record when nothing is set", () => {
    expect(snapshotOverrides()).toEqual({});
  });

  it("reads registry keys from their native storage", () => {
    sessionStorage.setItem("flemo:apply", "scrub");
    localStorage.setItem("flemo:motion-driver", "css");
    const active = snapshotOverrides();
    expect(active["flemo:apply"]).toBe("scrub");
    expect(active["flemo:motion-driver"]).toBe("css");
  });

  it("captures the legacy localStorage force pin under a marked key", () => {
    localStorage.setItem("flemo:motion-driver-force", "raf");
    const active = snapshotOverrides();
    expect(active[LEGACY_LOCAL_PIN_KEY]).toBe("raf");
  });

  it("captures unknown flemo:* keys from either storage", () => {
    sessionStorage.setItem("flemo:mystery", "42");
    const active = snapshotOverrides();
    const key = Object.keys(active).find((entry) => entry.startsWith("flemo:mystery"));
    expect(key).toBeDefined();
    expect(key).toContain("unknown key");
    expect(active[key as string]).toBe("42");
  });

  it("records an unknown key that vanishes between enumeration and read as empty", () => {
    // Another tab can remove a key in the window between key(index) and
    // getItem() — the entry must still be reported, with an empty value,
    // never as the string "null".
    const racing = {
      get length() {
        return 1;
      },
      key: () => "flemo:ghost",
      getItem: () => null
    };
    vi.stubGlobal("sessionStorage", racing);
    const active = snapshotOverrides();
    expect(active["flemo:ghost (sessionStorage, unknown key)"]).toBe("");
  });

  it("lists the force pin from its registry entry, never as an unknown key", () => {
    const pinned = {
      get length() {
        return 1;
      },
      key: () => "flemo:motion-driver-force",
      getItem: () => "raf@1700000000000"
    };
    vi.stubGlobal("sessionStorage", pinned);

    const active = snapshotOverrides();

    // The registry index covers the pin, so enumeration must not re-list it.
    expect(Object.keys(active).some((key) => key.includes("unknown key"))).toBe(false);
    expect(active["flemo:motion-driver-force"]).toBe("raf@1700000000000");
  });

  it("returns an empty record when storage access throws entirely", () => {
    const throwing = new Proxy(
      {},
      {
        get() {
          throw new Error("partitioned");
        }
      }
    );
    vi.stubGlobal("sessionStorage", throwing);
    vi.stubGlobal("localStorage", throwing);
    expect(snapshotOverrides()).toEqual({});
    vi.unstubAllGlobals();
  });

  it("tolerates a storage whose getItem throws after a healthy probe", () => {
    sessionStorage.setItem("flemo:apply", "scrub");
    const flaky = {
      get length() {
        return 1;
      },
      key: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      }
    };
    vi.stubGlobal("sessionStorage", flaky);
    // Registry reads degrade to unset; enumeration degrades to nothing.
    expect(snapshotOverrides()).toEqual({});
    vi.unstubAllGlobals();
  });
});

describe("deriveOverrideWarnings", () => {
  it("returns nothing for an empty snapshot", () => {
    expect(deriveOverrideWarnings({})).toEqual([]);
  });

  it("warns LOUDLY about an active force pin", () => {
    const warnings = deriveOverrideWarnings({ "flemo:motion-driver-force": "raf@1700000000000" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("flemo:motion-driver-force=raf@1700000000000");
    expect(warnings[0]).toContain("A DRIVER PIN IS ACTIVE");
  });

  it("warns about a since-cleared force pin (the marked-key variant)", () => {
    const warnings = deriveOverrideWarnings({
      "flemo:motion-driver-force (at attach, since cleared)": "raf"
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("flemo:motion-driver-force");
    expect(warnings[0]).toContain("since-cleared");
  });

  it("warns about the legacy localStorage pin location", () => {
    const warnings = deriveOverrideWarnings({ [LEGACY_LOCAL_PIN_KEY]: "raf" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("legacy localStorage");
  });

  it("warns about opt-in diagnostics as possible A/B residue", () => {
    const warnings = deriveOverrideWarnings({ "flemo:apply": "scrub" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("flemo:apply=scrub");
    expect(warnings[0]).toContain("left-over A/B toggle");
  });

  it("warns about overridden production defaults", () => {
    const warnings = deriveOverrideWarnings({ "flemo:settle-gate": "off" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("production default overridden");
  });

  it("does not warn about learned production-state ledgers or the devtools arming key", () => {
    expect(deriveOverrideWarnings({ "flemo:lat": "120", "flemo:devtools": "on" })).toEqual([]);
  });
});
