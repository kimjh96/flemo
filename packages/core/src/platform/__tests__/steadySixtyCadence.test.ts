import { afterEach, describe, expect, it, vi } from "vitest";

import {
  reportInFlightCadence,
  resetSteadySixtyForTests,
  steadySixtyDesktopProfile,
  steadySixtyVerified
} from "@platform/steadySixtyCadence";

const NAV = navigator as { userAgentData?: unknown };

describe("steadySixtyCadence verdict", () => {
  afterEach(() => {
    resetSteadySixtyForTests();
    delete NAV.userAgentData;
  });

  it("stays unknown until two consecutive qualifying flights", () => {
    expect(steadySixtyVerified()).toBe(false);
    reportInFlightCadence(16.7);
    expect(steadySixtyVerified()).toBe(false);
    reportInFlightCadence(16.7);
    expect(steadySixtyVerified()).toBe(true);
  });

  it("accepts the whole steady-60 window", () => {
    reportInFlightCadence(14);
    reportInFlightCadence(22);
    expect(steadySixtyVerified()).toBe(true);
  });

  it("treats slow medians as neutral: no advance, no reset", () => {
    // A push whose median rides a heavy mount commit must not erase the
    // evidence of the clean flights around it…
    reportInFlightCadence(16.7);
    reportInFlightCadence(33.3);
    expect(steadySixtyVerified()).toBe(false);
    reportInFlightCadence(16.7);
    expect(steadySixtyVerified()).toBe(true);

    resetSteadySixtyForTests();
    // …while a 30Hz power governor only ever produces slow medians, so it
    // can never accumulate the two qualifying readings.
    reportInFlightCadence(33.3);
    reportInFlightCadence(33.3);
    reportInFlightCadence(33.3);
    expect(steadySixtyVerified()).toBe(false);
  });

  it("resets the streak on the ambiguous 12-14ms band", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(13);
    reportInFlightCadence(16.7);
    expect(steadySixtyVerified()).toBe(false);
  });

  it("latches high-refresh permanently on a single sub-12ms median", () => {
    reportInFlightCadence(8.3);
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    // A machine that CAN present at 120Hz must stay compiled: partial
    // presents there are invisible to rAF, so the latch is the protection.
    expect(steadySixtyVerified()).toBe(false);
  });

  it("ignores non-finite and non-positive reports", () => {
    reportInFlightCadence(NaN);
    reportInFlightCadence(-5);
    reportInFlightCadence(Infinity);
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    expect(steadySixtyVerified()).toBe(true);
  });

  it("gates eligibility on Blink + non-touch + HiDPI on top of the verdict", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);

    // jsdom: non-Blink (no userAgentData), dpr 1 — verdict alone is not enough.
    expect(steadySixtyDesktopProfile()).toBe(false);

    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    // jsdom ships no maxTouchPoints; a real desktop Blink reports 0.
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    const originalDpr = window.devicePixelRatio;
    try {
      Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
      expect(steadySixtyDesktopProfile()).toBe(true);
      Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
      expect(steadySixtyDesktopProfile()).toBe(false);
    } finally {
      Object.defineProperty(window, "devicePixelRatio", {
        value: originalDpr,
        configurable: true
      });
      delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    }
  });
});

describe("steadySixtyCadence persistence", () => {
  afterEach(() => {
    resetSteadySixtyForTests();
    delete NAV.userAgentData;
  });

  it("mirrors the verdict into sessionStorage for reload seeding", () => {
    reportInFlightCadence(16.7);
    expect(sessionStorage.getItem("flemo:sixty")).toBe("1");
    reportInFlightCadence(16.7);
    expect(sessionStorage.getItem("flemo:sixty")).toBe("2");
    reportInFlightCadence(8.3);
    expect(sessionStorage.getItem("flemo:sixty")).toBe("high");
  });

  it("the test reset clears the persisted seed", () => {
    reportInFlightCadence(16.7);
    resetSteadySixtyForTests();
    expect(sessionStorage.getItem("flemo:sixty")).toBeNull();
  });
});

describe("high-latch uniformity guard", () => {
  afterEach(() => {
    resetSteadySixtyForTests();
  });

  it("a fast median with a jam-sized max gap is noise, not a high-refresh panel", () => {
    // rAF catch-up burst after a main-thread jam: median 6ms, one 80ms gap.
    reportInFlightCadence(6, 80);
    reportInFlightCadence(16.7, 18);
    reportInFlightCadence(16.7, 18);
    expect(steadySixtyVerified()).toBe(true);
  });

  it("a uniform fast window still latches high", () => {
    reportInFlightCadence(8.3, 9.1);
    reportInFlightCadence(16.7, 18);
    reportInFlightCadence(16.7, 18);
    expect(steadySixtyVerified()).toBe(false);
  });
});

// The verdict is PERSISTED (flemo:sixty) so a reload does not re-run the
// two-flight compiled warm-up. The seed is read once at module load, which
// makes a fresh module instance the only way to exercise it.
describe("steadySixtyCadence reload seeding", () => {
  const freshModule = async () => {
    vi.resetModules();
    return import("@platform/steadySixtyCadence");
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    sessionStorage.clear();
    resetSteadySixtyForTests();
  });

  it("resumes a partial streak from the persisted count", async () => {
    sessionStorage.setItem("flemo:sixty", "1");
    const seeded = await freshModule();

    expect(seeded.steadySixtyVerified()).toBe(false);
    // One qualifying flight is enough — the reload kept the first one.
    seeded.reportInFlightCadence(16.7);
    expect(seeded.steadySixtyVerified()).toBe(true);
  });

  it("resumes the high-refresh latch across a reload", async () => {
    sessionStorage.setItem("flemo:sixty", "high");
    const seeded = await freshModule();

    seeded.reportInFlightCadence(16.7);
    seeded.reportInFlightCadence(16.7);
    expect(seeded.steadySixtyVerified()).toBe(false);
  });

  it("starts from zero on a garbage seed", async () => {
    sessionStorage.setItem("flemo:sixty", "not-a-number");
    const seeded = await freshModule();

    seeded.reportInFlightCadence(16.7);
    expect(seeded.steadySixtyVerified()).toBe(false);
    seeded.reportInFlightCadence(16.7);
    expect(seeded.steadySixtyVerified()).toBe(true);
  });

  it("runs verdict-only where sessionStorage is absent", async () => {
    vi.stubGlobal("sessionStorage", undefined);
    const storageless = await freshModule();

    storageless.reportInFlightCadence(16.7);
    storageless.reportInFlightCadence(16.7);
    // The session's own verdict still forms; only the reload seed is lost.
    expect(storageless.steadySixtyVerified()).toBe(true);
  });

  it("survives a storage that throws on read and on write", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("storage blocked");
      }
    });
    const blocked = await freshModule();

    expect(() => blocked.reportInFlightCadence(16.7)).not.toThrow();
    blocked.reportInFlightCadence(16.7);
    expect(blocked.steadySixtyVerified()).toBe(true);
  });

  it("leaves the latched seed alone when an ambiguous median follows", () => {
    reportInFlightCadence(8.3);
    expect(sessionStorage.getItem("flemo:sixty")).toBe("high");
    // The 12-14ms band resets the streak, but a latched session must never
    // overwrite "high" with a streak count.
    reportInFlightCadence(13);
    expect(sessionStorage.getItem("flemo:sixty")).toBe("high");
  });

  it("treats a missing devicePixelRatio as 1x, outside the HiDPI profile", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    const originalDpr = window.devicePixelRatio;
    try {
      Object.defineProperty(window, "devicePixelRatio", { value: 0, configurable: true });
      expect(steadySixtyDesktopProfile()).toBe(false);
    } finally {
      Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
      delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
      delete NAV.userAgentData;
    }
  });
  // A phone can never read this verdict (the profile is non-touch by
  // definition), so it must not pay to build one — the per-flight
  // sessionStorage write is the cost that matters on exactly those devices.
  // Observed in the field: a Galaxy Note 9 session carrying `flemo:sixty: "2"`
  // that nothing would ever consult.
  describe("touch sessions", () => {
    const withTouch = (points: number, run: () => void) => {
      Object.defineProperty(navigator, "maxTouchPoints", { value: points, configurable: true });
      try {
        run();
      } finally {
        Reflect.deleteProperty(navigator, "maxTouchPoints");
      }
    };

    it("neither accumulates nor persists the verdict", () => {
      sessionStorage.removeItem("flemo:sixty");
      withTouch(5, () => {
        reportInFlightCadence(16.7);
        reportInFlightCadence(16.7);
        expect(steadySixtyVerified()).toBe(false);
      });
      expect(sessionStorage.getItem("flemo:sixty")).toBe(null);
    });

    it("still accumulates for a non-touch session", () => {
      sessionStorage.removeItem("flemo:sixty");
      withTouch(0, () => {
        reportInFlightCadence(16.7);
        reportInFlightCadence(16.7);
        expect(steadySixtyVerified()).toBe(true);
      });
      expect(sessionStorage.getItem("flemo:sixty")).toBe("2");
    });
  });
});
