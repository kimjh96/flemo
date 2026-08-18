import { afterEach, describe, expect, it } from "vitest";

import {
  reportInFlightCadence,
  resetSteadySixtyForTests,
  steadySixtyPlayerEligible,
  steadySixtyVerified
} from "@core/engine/steadySixtyCadence";

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
    expect(steadySixtyPlayerEligible()).toBe(false);

    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    // jsdom ships no maxTouchPoints; a real desktop Blink reports 0.
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    const originalDpr = window.devicePixelRatio;
    try {
      Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
      expect(steadySixtyPlayerEligible()).toBe(true);
      Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
      expect(steadySixtyPlayerEligible()).toBe(false);
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
