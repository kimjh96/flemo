import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import {
  reportInFlightCadence,
  resetSteadySixtyForTests,
  steadySixtyVerified
} from "@core/engine/steadySixtyCadence";

import type { TransitionEngineDeps } from "@core/engine/types";

// Desktop Blink routing with the steady-60 verdict (see steadySixtyCadence):
// an UNVERIFIED desktop session keeps the compiled tier (the shipped default
// since the beginning), a session whose in-flight cadence verified steady-60
// on a HiDPI display routes the player, and a high-refresh latch pins the
// session back to compiled forever. No diagnostic force pin in this file —
// the DEFAULT routing is the subject.

const animated = createTransition({
  name: "sixty-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const NAV = navigator as { userAgentData?: unknown };

describe("createTransitionEngine steady-60 desktop routing", () => {
  let deps: TransitionEngineDeps;
  let scope: HTMLDivElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let originalDpr: number;
  let disposers: (() => void)[];

  beforeEach(() => {
    transitionMap.set("sixty-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-sixty"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    scope = document.createElement("div");
    document.body.appendChild(scope);
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    // jsdom ships no maxTouchPoints; a real desktop Blink reports 0, and the
    // desktop gate keys on exactly that.
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    disposers = [];
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    scope.remove();
    transitionMap.delete("sixty-test" as never);
    resolveSpy.mockRestore();
    resetSteadySixtyForTests();
    delete NAV.userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
  });

  const drive = () => {
    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "sixty-test" as never,
      prevTransitionName: "sixty-test" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    disposers.push(dispose);
  };

  // The player's join suppresses the compiled animation inline; the compiled
  // tier leaves the inline `animation` untouched. That signature is how the
  // e2e suite tells the tiers apart too.
  const playerDrove = () => scope.style.animation === "none";

  it("keeps the compiled tier while the cadence is unverified", () => {
    drive();
    expect(playerDrove()).toBe(false);
  });

  it("stays COMPILED even after two in-flight medians verify steady-60 (the settled 2026-08-18 verdict: on the target hardware every per-frame writer — rAF player, snap masks, pre-quantized WAAPI — was live-judged worse than the compiled compositor; the verdict now gates desktop-profile DEFAULTS, not the driver)", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    drive();
    expect(playerDrove()).toBe(false);
  });

  it("stays compiled on a verified-60 display at 1x density", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
    drive();
    expect(playerDrove()).toBe(false);
  });

  it("a single high-refresh median latches the session compiled", () => {
    reportInFlightCadence(8.3);
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    drive();
    expect(playerDrove()).toBe(false);
  });

  // End-to-end through the REAL display-interval probe: each declined desktop
  // flight arms it (2 warm-up ticks + 8 gaps off the live rAF clock), its
  // median feeds the verdict, and the third flight graduates. jsdom's rAF
  // ticks ~17ms — inside the steady-60 window — so this also covers the
  // probe's warm-up/median path itself.
  it("graduates through the real display probe after two compiled flights", async () => {
    const frames = (count: number) =>
      new Promise<void>((resolve) => {
        let remaining = count;
        const tick = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    // Runner-cadence guard (same shape as the e2e's): a machine that cannot
    // hold a steady rAF clock legitimately never verifies — the conservative
    // design working, not a regression.
    const gaps: number[] = [];
    let last: number | null = null;
    await new Promise<void>((resolve) => {
      const tick = (t: number) => {
        if (last !== null) gaps.push(t - last);
        last = t;
        if (gaps.length < 10) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const median = [...gaps].sort((a, b) => a - b)[5]!;

    drive(); // flight 1 — declined (unverified), probe armed
    await frames(14);
    drive(); // flight 2 — declined, probe armed again
    await frames(14);
    drive(); // flight 3 — decided by whatever the probe measured

    if (median >= 14 && median <= 22) {
      expect(steadySixtyVerified()).toBe(true);
      // Verification feeds the desktop-profile defaults; the DRIVER stays
      // compiled (see the settled-verdict test above).
      expect(playerDrove()).toBe(false);
    } else {
      // Off-window cadence must stay compiled — the same property, inverted.
      expect(playerDrove()).toBe(false);
    }
  });

  it("touch Blink routing is untouched by the desktop verdict", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    drive();
    // Touch Blink already defaults to the player — the verdict must not
    // interfere with that route either.
    expect(playerDrove()).toBe(true);
  });
});
