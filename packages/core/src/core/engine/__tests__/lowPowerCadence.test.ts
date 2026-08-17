import { afterEach, describe, expect, it, vi } from "vitest";

import {
  lowPowerCadenceActive,
  lowPowerFrameIntervalMs,
  probeLowPowerCadence,
  resetLowPowerCadenceForTests
} from "@core/engine/lowPowerCadence";

// iOS Low Power Mode cadence detection (lowPowerCadence.ts): a REGULAR
// 28-42ms rAF cluster raises the flag, a regular fast cluster clears it, an
// inconclusive (irregular) window changes nothing. Isolated state — never
// the player's learned interval. Verdicts persist to sessionStorage so a
// reload inside an LPM session arms without paying a 30fps first flight.

const withTouch = <T>(run: () => T): T => {
  Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
  try {
    return run();
  } finally {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
  }
};

const pumpProbe = (gaps: number[]) => {
  const rafCbs: FrameRequestCallback[] = [];
  const raf = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
  probeLowPowerCadence();
  let t = 1000;
  rafCbs.shift()!(t); // baseline tick
  for (const gap of gaps) {
    t += gap;
    rafCbs.shift()!(t);
  }
  raf.mockRestore();
};

describe("lowPowerCadence", () => {
  afterEach(() => {
    resetLowPowerCadenceForTests();
    sessionStorage.removeItem("flemo:lpm");
  });

  it("a regular 33ms cluster (LPM cap) raises the flag and persists it", () => {
    withTouch(() => pumpProbe([33, 33.4, 33.1, 33.6, 33.2, 33.4]));
    expect(lowPowerCadenceActive()).toBe(true);
    expect(sessionStorage.getItem("flemo:lpm")).toBe("1");
  });

  it("one outlier does not blind the detection", () => {
    withTouch(() => pumpProbe([33, 33.4, 66, 33.6, 33.2, 33.4]));
    expect(lowPowerCadenceActive()).toBe(true);
  });

  it("a conclusive slow cluster learns its median frame interval; a lift forgets it", () => {
    withTouch(() => pumpProbe([36, 36.4, 36.1, 36.6, 36.2, 36.4]));
    expect(lowPowerCadenceActive()).toBe(true);
    const learned = lowPowerFrameIntervalMs();
    expect(learned).not.toBeNull();
    expect(learned!).toBeGreaterThanOrEqual(36);
    expect(learned!).toBeLessThanOrEqual(36.6);
    withTouch(() => pumpProbe([16.7, 16.6, 16.8, 16.7, 16.6, 16.7]));
    expect(lowPowerFrameIntervalMs()).toBeNull();
  });

  it("a regular fast cluster clears the flag (LPM lifted) and persists it", () => {
    withTouch(() => pumpProbe([33, 33.4, 33.1, 33.6, 33.2, 33.4]));
    expect(lowPowerCadenceActive()).toBe(true);
    withTouch(() => pumpProbe([16.7, 16.6, 16.8, 16.7, 16.6, 16.7]));
    expect(lowPowerCadenceActive()).toBe(false);
    expect(sessionStorage.getItem("flemo:lpm")).toBe("0");
  });

  it("an irregular window (genuine starvation) stays inconclusive", () => {
    withTouch(() => pumpProbe([16, 80, 33, 120, 16, 55]));
    expect(lowPowerCadenceActive()).toBe(false);
  });

  it("never runs without touch (desktop keeps its own routing)", () => {
    const rafCbs: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length));
    probeLowPowerCadence(); // maxTouchPoints 0: must not even schedule
    expect(rafCbs.length).toBe(0);
    raf.mockRestore();
    expect(lowPowerCadenceActive()).toBe(false);
  });
});
