import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  createDriverPolicy,
  detectBlinkEngine,
  FORCE_PIN_TTL_MS,
  isDesktopMacWebKit
} from "@core/engine/driverPolicy";

// The policy is pin-only since 2026-08-19: the stall-demotion machinery
// (per-run gap accounting, strikes, the persisted `flemo:motion-driver`
// ledger, its probation probe) was removed with the Blink unification, which
// left it nothing to decide. What remains under test is the force pin and its
// self-healing rules — the pin is now the ONLY thing that can change the
// driver, so its failure modes are the whole surface.

// Node >= 22 ships an experimental global `localStorage` that reads as
// `undefined` unless --localstorage-file is passed. In the vitest jsdom
// environment `window === globalThis`, so that Node global shadows jsdom's
// storage. Back it with an in-memory Storage-shaped stub when it's
// unavailable; where jsdom's real storage resolves (e.g. CI's Node 24) this
// is a no-op. Still needed here: the pin reader STRIPS a legacy localStorage
// pin on every read.
beforeAll(() => {
  const available = (() => {
    try {
      return typeof localStorage !== "undefined" && localStorage != null;
    } catch {
      return false;
    }
  })();
  if (available) return;
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      }
    }
  });
});

describe("driverPolicy", () => {
  it("returns its engine default when no pin is active", () => {
    expect(createDriverPolicy(true).playerAllowed()).toBe(true);
    expect(createDriverPolicy(false).playerAllowed()).toBe(false);
  });

  it("the force key overrides the engine default in both directions, warning once", () => {
    const nonBlink = createDriverPolicy(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
    expect(nonBlink.playerAllowed()).toBe(true);
    // An active pin is never silent (a forgotten key reads as a mysterious
    // perf regression) — but it warns once per session, not per transition.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("flemo:motion-driver-force");
    expect(nonBlink.playerAllowed()).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    sessionStorage.removeItem("flemo:motion-driver-force");
    expect(nonBlink.playerAllowed()).toBe(false);
    warn.mockRestore();
  });

  it("pins live, in both directions, and discards an invalid value on sight", () => {
    const policy = createDriverPolicy(true);

    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
    expect(policy.playerAllowed()).toBe(true);

    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    expect(policy.playerAllowed()).toBe(false);

    sessionStorage.setItem("flemo:motion-driver-force", "garbage");
    expect(policy.playerAllowed()).toBe(true); // invalid value = no override
    expect(sessionStorage.getItem("flemo:motion-driver-force")).toBe(null);
  });

  it("ignores and removes an unstamped or expired session pin", () => {
    // sessionStorage alone proved insufficient: mobile tab restoration
    // resurrects it across days, and a stale plain "raf" pin from an old
    // debugging session reproduced the player's whole delay/mid-start
    // profile on a restored tab. Unstamped and expired pins are removed on
    // the next decision so the profile self-heals.
    const policy = createDriverPolicy(false);

    sessionStorage.setItem("flemo:motion-driver-force", "raf");
    expect(policy.playerAllowed()).toBe(false); // plain legacy: never honored
    expect(sessionStorage.getItem("flemo:motion-driver-force")).toBe(null); // healed

    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now() - FORCE_PIN_TTL_MS - 1}`);
    expect(policy.playerAllowed()).toBe(false); // expired: never honored
    expect(sessionStorage.getItem("flemo:motion-driver-force")).toBe(null); // healed
  });

  it("strips a legacy localStorage pin without honoring it", () => {
    // The pin once lived in localStorage, where a forgotten debugging session
    // kept pinning every future session. A legacy value must not drive the
    // decision, and reading the policy must delete it so the profile heals.
    const policy = createDriverPolicy(false);
    window.localStorage.setItem("flemo:motion-driver-force", "raf");
    expect(policy.playerAllowed()).toBe(false); // never honored
    expect(window.localStorage.getItem("flemo:motion-driver-force")).toBe(null); // healed
  });

  it("tolerates a throwing localStorage during the legacy pin strip", () => {
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(createDriverPolicy(true).playerAllowed()).toBe(true);
    removeItem.mockRestore();
  });

  it("tolerates a throwing sessionStorage (embedder storage policies)", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(createDriverPolicy(true).playerAllowed()).toBe(true);
    getItem.mockRestore();
  });
});

describe("detectBlinkEngine", () => {
  it("reads a Chromium brand as the Blink signal, not mere userAgentData presence", () => {
    expect(detectBlinkEngine()).toBe(false); // jsdom ships none
    // WebKit shipped userAgentData with no Chromium brand → still non-Blink.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Safari", version: "18" }] },
      configurable: true
    });
    expect(detectBlinkEngine()).toBe(false);
    // Empty/absent brands → non-Blink.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [] },
      configurable: true
    });
    expect(detectBlinkEngine()).toBe(false);
    // A Chromium brand → Blink.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Chromium", version: "120" }, { brand: "Not?A_Brand" }] },
      configurable: true
    });
    expect(detectBlinkEngine()).toBe(true);
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  });
});

describe("engine-scoped default instance", () => {
  it("defaults to the player on Blink too — routing, not the policy, sends Blink compiled", async () => {
    vi.resetModules();
    const original = Object.getOwnPropertyDescriptor(navigator, "userAgentData");
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Chromium", version: "120" }] },
      configurable: true
    });
    try {
      const { default: policy, detectBlinkEngine: detect } =
        await import("@core/engine/driverPolicy");
      expect(detect()).toBe(true);
      // The policy no longer knows about engines at all: joinPlayer's gate 2
      // returns the compiled tier for every Blink flight before the policy is
      // consulted, so this default is only reached on touch WebKit.
      expect(policy.playerAllowed()).toBe(true);
    } finally {
      if (original) Object.defineProperty(navigator, "userAgentData", original);
      else delete (navigator as { userAgentData?: unknown }).userAgentData;
    }
  });
});

// The predicate two callers must agree on: joinPlayer's gate 3 (which routes
// this session to the wall-clocked compiled tier) and readSettleGateFlag's
// default (which keeps a heavy entering mount from eating that tier's opening).
describe("isDesktopMacWebKit", () => {
  const stub = (over: { platform?: string; touch?: number; blink?: boolean }) => {
    Object.defineProperty(navigator, "platform", {
      value: over.platform ?? "",
      configurable: true
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: over.touch ?? 0,
      configurable: true
    });
    if (over.blink) {
      Object.defineProperty(navigator, "userAgentData", {
        value: { brands: [{ brand: "Chromium", version: "120" }] },
        configurable: true
      });
    } else {
      delete (navigator as { userAgentData?: unknown }).userAgentData;
    }
  };

  const restore = () => {
    Reflect.deleteProperty(navigator, "platform");
    Reflect.deleteProperty(navigator, "maxTouchPoints");
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  };

  it("is true for a non-touch Mac WebKit session (desktop Safari)", () => {
    stub({ platform: "MacIntel" });
    try {
      expect(isDesktopMacWebKit()).toBe(true);
    } finally {
      restore();
    }
  });

  it("is false for an iPad spoofing a Mac platform (touch keeps the player)", () => {
    stub({ platform: "MacIntel", touch: 5 });
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false for desktop Blink on a Mac", () => {
    stub({ platform: "MacIntel", blink: true });
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false where the platform is empty (jsdom, and any non-Mac desktop)", () => {
    stub({ platform: "" });
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      restore();
    }
  });
});
