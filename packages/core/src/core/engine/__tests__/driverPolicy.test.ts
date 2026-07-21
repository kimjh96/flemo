import { describe, expect, it, vi } from "vitest";

import {
  createDriverPolicy,
  detectBlinkEngine,
  FORCE_PIN_TTL_MS,
  type DriverPolicyStorage
} from "@core/engine/driverPolicy";

const memoryStorage = (initial: string | null = null) => {
  let value = initial;
  const storage: DriverPolicyStorage = {
    read: () => value,
    write: (next) => {
      value = next;
    }
  };
  return { storage, value: () => value };
};

const stalledRun = (policy: ReturnType<typeof createDriverPolicy>) => {
  policy.beginRun();
  policy.reportGap(65);
  policy.reportGap(49);
  policy.endRun();
};

const cleanRun = (policy: ReturnType<typeof createDriverPolicy>) => {
  policy.beginRun();
  for (let i = 0; i < 30; i++) policy.reportGap(16.7);
  policy.endRun();
};

describe("driverPolicy", () => {
  it("allows the player by default and after clean runs", () => {
    const { storage } = memoryStorage();
    const policy = createDriverPolicy(storage, true);
    expect(policy.playerAllowed()).toBe(true);
    cleanRun(policy);
    cleanRun(policy);
    expect(policy.playerAllowed()).toBe(true);
  });

  it("demotes after two stalled transitions and persists the decision", () => {
    const { storage, value } = memoryStorage();
    const policy = createDriverPolicy(storage, true);
    stalledRun(policy);
    expect(policy.playerAllowed()).toBe(true); // one strike = cold-start grace
    stalledRun(policy);
    expect(policy.playerAllowed()).toBe(false);
    expect(value()).toBe("css");
  });

  it("a persisted demotion becomes probation: one clean probe promotes back", () => {
    const { storage, value } = memoryStorage("css");
    const policy = createDriverPolicy(storage, true);
    // Probation: the player gets one probe transition.
    expect(policy.playerAllowed()).toBe(true);
    cleanRun(policy);
    expect(policy.playerAllowed()).toBe(true);
    expect(value()).toBe("raf");
  });

  it("a stalling probe re-confirms the demotion for the session", () => {
    const { storage } = memoryStorage("css");
    const policy = createDriverPolicy(storage, true);
    expect(policy.playerAllowed()).toBe(true);
    stalledRun(policy);
    expect(policy.playerAllowed()).toBe(false);
  });

  it("a few merely-late frames (sub-30ms) never count as a stall", () => {
    const { storage } = memoryStorage();
    const policy = createDriverPolicy(storage, true);
    for (let i = 0; i < 5; i++) {
      policy.beginRun();
      policy.reportGap(18.5);
      policy.reportGap(22);
      policy.reportGap(28);
      policy.endRun();
    }
    expect(policy.playerAllowed()).toBe(true);
  });

  it("exposes the current run's diagnostics through stats()", () => {
    const { storage } = memoryStorage();
    const policy = createDriverPolicy(storage, true);
    policy.beginRun();
    policy.reportGap(65);
    policy.reportGap(49);
    policy.endRun();
    expect(policy.stats()).toEqual({ runGaps: [65, 49], strikes: 1, demoted: false });
  });
});

describe("driverPolicy engine default", () => {
  it("keeps the player off by default on Blink (the compiled path composites there)", () => {
    const { storage } = memoryStorage();
    const policy = createDriverPolicy(storage);
    expect(policy.playerAllowed()).toBe(false);
  });

  it("a non-demotable player default survives stall strikes AND a persisted demotion", () => {
    // The non-Blink wiring: WebKit presents the compiled path from the main
    // thread (device-glass freeze-then-jump), so there is no better tier to
    // demote to — chronic gaps must not flip the driver, and a demotion an
    // older version persisted is ignored.
    const writes: string[] = [];
    const storage: DriverPolicyStorage = {
      read: () => "css", // an older version's persisted demotion
      write: (next) => {
        writes.push(next);
      }
    };
    const policy = createDriverPolicy(storage, true, false);
    expect(policy.playerAllowed()).toBe(true);

    for (let run = 0; run < 4; run++) {
      policy.beginRun();
      policy.reportGap(65);
      policy.reportGap(80);
      policy.endRun();
    }
    expect(policy.playerAllowed()).toBe(true);
    // Diagnostics keep counting; nothing was persisted by the runs.
    expect(policy.stats().strikes).toBe(4);
    expect(policy.stats().demoted).toBe(false);
    expect(writes).toEqual([]);
  });

  it("the force key overrides the engine default in both directions, warning once", () => {
    const { storage } = memoryStorage();
    const nonBlink = createDriverPolicy(storage, false);
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
});

describe("detectBlinkEngine", () => {
  it("reads userAgentData presence as the Blink signal", () => {
    expect(detectBlinkEngine()).toBe(false); // jsdom ships none
    Object.defineProperty(navigator, "userAgentData", { value: {}, configurable: true });
    expect(detectBlinkEngine()).toBe(true);
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  });
});

describe("driverPolicy default storage", () => {
  it("round-trips through localStorage and tolerates absence", () => {
    localStorage.removeItem("flemo:motion-driver");
    const policy = createDriverPolicy(undefined, true);
    expect(policy.playerAllowed()).toBe(true);
    stalledRun(policy);
    stalledRun(policy);
    expect(policy.playerAllowed()).toBe(false);
    expect(localStorage.getItem("flemo:motion-driver")).toBe("css");
    localStorage.removeItem("flemo:motion-driver");
  });

  it("the force key pins the driver, bypassing strikes and probation, and warns", () => {
    const { storage } = memoryStorage("css"); // persisted demotion...
    const policy = createDriverPolicy(storage, true);

    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
    expect(policy.playerAllowed()).toBe(true); // ...overridden to the player

    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    expect(policy.playerAllowed()).toBe(false); // pinned to CSS live

    sessionStorage.setItem("flemo:motion-driver-force", "garbage");
    expect(policy.playerAllowed()).toBe(true); // invalid value = no override
    // ...and an invalid value is removed on sight, not left to linger.
    expect(sessionStorage.getItem("flemo:motion-driver-force")).toBe(null);
  });

  it("ignores and removes an unstamped or expired session pin", () => {
    // sessionStorage alone proved insufficient: mobile tab restoration
    // resurrects it across days, and a stale plain "raf" pin from an old
    // debugging session reproduced the player's whole delay/mid-start
    // profile on a restored tab. Unstamped and expired pins are removed on
    // the next decision so the profile self-heals.
    const { storage } = memoryStorage();
    const policy = createDriverPolicy(storage, false);

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
    const { storage } = memoryStorage();
    const policy = createDriverPolicy(storage, false);
    localStorage.setItem("flemo:motion-driver-force", "raf");
    expect(policy.playerAllowed()).toBe(false); // never honored
    expect(localStorage.getItem("flemo:motion-driver-force")).toBe(null); // healed
  });

  it("tolerates a throwing localStorage during the legacy pin strip", () => {
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const { storage } = memoryStorage();
    const policy = createDriverPolicy(storage, true);
    expect(policy.playerAllowed()).toBe(true);
    removeItem.mockRestore();
  });

  it("tolerates a throwing localStorage (embedder storage policies)", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const policy = createDriverPolicy(undefined, true);
    expect(policy.playerAllowed()).toBe(true);
    getItem.mockRestore();
  });
});
