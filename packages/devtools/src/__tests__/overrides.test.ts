import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deriveOverrideWarnings,
  FLAG_REGISTRY,
  RETIRED_FLAGS,
  RETIRED_MARKER,
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
      "flemo:sixty",
      "flemo:imghold",
      "flemo:arrivalhold",
      "flemo:settle-gate",
      "flemo:deskflip",
      "flemo:deskhead",
      "flemo:creep",
      "flemo:relcommit",
      "flemo:layers",
      "flemo:freeze",
      "flemo:preraster"
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it("never lists a retired key as live", () => {
    const live = new Set(FLAG_REGISTRY.map((flag) => flag.key));
    for (const retired of RETIRED_FLAGS) expect(live.has(retired.key)).toBe(false);
  });
});

describe("snapshotOverrides", () => {
  it("returns an empty record when nothing is set", () => {
    expect(snapshotOverrides()).toEqual({});
  });

  it("reads registry keys from their native storage", () => {
    sessionStorage.setItem("flemo:settle-gate", "off");
    const active = snapshotOverrides();
    expect(active["flemo:settle-gate"]).toBe("off");
  });

  it("captures a retired key from either storage, marked as retired", () => {
    localStorage.setItem("flemo:motion-driver-force", "raf");
    sessionStorage.setItem("flemo:apply", "scrub");
    const active = snapshotOverrides();
    expect(active[`flemo:motion-driver-force (localStorage) ${RETIRED_MARKER}`]).toBe("raf");
    expect(active[`flemo:apply (sessionStorage) ${RETIRED_MARKER}`]).toBe("scrub");
    // …and never as a live key or an unknown one.
    expect(active["flemo:apply"]).toBeUndefined();
    expect(Object.keys(active).some((key) => key.includes("unknown key"))).toBe(false);
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

  it("lists a retired key from its retirement entry, never as an unknown key", () => {
    const pinned = {
      get length() {
        return 1;
      },
      key: () => "flemo:motion-driver-force",
      getItem: () => "raf@1700000000000"
    };
    vi.stubGlobal("sessionStorage", pinned);

    const active = snapshotOverrides();

    // The retirement index covers the pin, so enumeration must not re-list it.
    expect(Object.keys(active).some((key) => key.includes("unknown key"))).toBe(false);
    expect(active[`flemo:motion-driver-force (sessionStorage) ${RETIRED_MARKER}`]).toBe(
      "raf@1700000000000"
    );
  });

  it("skips an index whose key read comes back empty", () => {
    // Storage.key(i) can return null while another tab mutates the store; an
    // empty key is not a flag and must not be reported as an unknown one.
    vi.stubGlobal("sessionStorage", {
      get length() {
        return 2;
      },
      key: (index: number) => (index === 0 ? null : ""),
      getItem: () => null
    });
    expect(snapshotOverrides()).toEqual({});
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
    sessionStorage.setItem("flemo:settle-gate", "off");
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

  it("names a retired key as inert, so it is ruled OUT rather than chased", () => {
    const warnings = deriveOverrideWarnings({
      [`flemo:motion-driver-force (sessionStorage) ${RETIRED_MARKER}`]: "raf@1700000000000"
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("RETIRED residue");
    expect(warnings[0]).toContain("cannot explain anything");
    // The retirement note travels with the warning, so the reader learns what
    // the key used to do without leaving the report.
    expect(warnings[0]).toContain("the hard driver pin");
  });

  it("still names an unrecognised retired key as inert, without a retirement note", () => {
    // A marked key whose base name is not in the table (an older devtools build
    // reading a newer report, a hand-edited snapshot) must still be ruled out
    // rather than fall through as an active diagnostic.
    const warnings = deriveOverrideWarnings({
      [`flemo:from-the-future (sessionStorage) ${RETIRED_MARKER}`]: "1"
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("RETIRED residue");
    expect(warnings[0]).toContain("a removed feature");
  });

  it("warns about opt-in diagnostics as possible A/B residue", () => {
    const warnings = deriveOverrideWarnings({ "flemo:layers": "resident" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("flemo:layers=resident");
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
