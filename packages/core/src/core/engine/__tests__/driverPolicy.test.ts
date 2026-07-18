import { describe, expect, it, vi } from "vitest";

import { createDriverPolicy, type DriverPolicyStorage } from "@core/engine/driverPolicy";

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
  it("keeps the player off by default on every engine", () => {
    const { storage } = memoryStorage();
    // The compiled compositor drives by default everywhere; the player is a
    // pinned diagnostic tier (see the driverPolicy file header).
    const policy = createDriverPolicy(storage);
    expect(policy.playerAllowed()).toBe(false);
  });

  it("the force key overrides the engine default in both directions, warning once", () => {
    const { storage } = memoryStorage();
    const nonBlink = createDriverPolicy(storage, false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("flemo:motion-driver-force", "raf");
    expect(nonBlink.playerAllowed()).toBe(true);
    // An active pin is never silent (a forgotten key reads as a mysterious
    // perf regression) — but it warns once per session, not per transition.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("flemo:motion-driver-force");
    expect(nonBlink.playerAllowed()).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    localStorage.removeItem("flemo:motion-driver-force");
    expect(nonBlink.playerAllowed()).toBe(false);
    warn.mockRestore();
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

    localStorage.setItem("flemo:motion-driver-force", "raf");
    expect(policy.playerAllowed()).toBe(true); // ...overridden to the player

    localStorage.setItem("flemo:motion-driver-force", "css");
    expect(policy.playerAllowed()).toBe(false); // pinned to CSS live

    localStorage.setItem("flemo:motion-driver-force", "garbage");
    expect(policy.playerAllowed()).toBe(true); // invalid value = no override
    localStorage.removeItem("flemo:motion-driver-force");
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
