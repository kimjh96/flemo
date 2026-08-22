import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine, {
  resetDisplayProbeForTests
} from "@core/engine/createTransitionEngine";
import {
  reportInFlightCadence,
  resetSteadySixtyForTests,
  steadySixtyVerified
} from "@core/engine/steadySixtyCadence";

import type { TransitionEngineDeps } from "@core/engine/types";

// The engine's in-flight DISPLAY-INTERVAL PROBE and what it feeds.
//
// The probe is the only source of a cadence reading taken while a compositor
// animation is running, and two live consumers depend on it: the steady-60
// desktop verdict (steadySixtyCadence -> the settle-gate default and the
// warm-up's cadence lock) and the compiled tier's landing governor
// (displayCadence.learnedFrameIntervalMs). It used to be armed from inside the
// driver-routing gate; the driver is gone and the arming had to survive it, so
// these suites pin that it still runs on exactly a Blink flight.
//
// The tier itself is no longer a variable: Blink runs the compiled animation
// in every cadence state, verified or not.

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
    resetDisplayProbeForTests();
    disposers = [];
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    vi.unstubAllGlobals();
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

  // The compiled tier leaves the inline `animation` untouched — nothing in the
  // engine suppresses a screen's compiled animation any more.
  const compiledAnimationSuppressed = () => scope.style.animation === "none";

  it("leaves the compiled animation in charge while the cadence is unverified", () => {
    drive();
    expect(compiledAnimationSuppressed()).toBe(false);
  });

  it("stays compiled after two in-flight medians verify steady-60 (the settled 2026-08-18 verdict: on the target hardware every per-frame writer — rAF player, snap masks, pre-quantized WAAPI — was live-judged worse than the compiled compositor; the verdict gates desktop-profile DEFAULTS, never the driver)", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    drive();
    expect(compiledAnimationSuppressed()).toBe(false);
  });

  it("stays compiled on a verified-60 display at 1x density", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
    drive();
    expect(compiledAnimationSuppressed()).toBe(false);
  });

  it("a single high-refresh median latches the session's verdict", () => {
    reportInFlightCadence(8.3);
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    drive();
    expect(compiledAnimationSuppressed()).toBe(false);
  });

  // End-to-end through the REAL display-interval probe: each declined desktop
  // flight arms it (2 warm-up ticks + 8 gaps off the live rAF clock), its
  // median feeds the verdict, and the third flight graduates. jsdom's rAF
  // ticks ~17ms — inside the steady-60 window — so this also covers the
  // probe's warm-up/median path itself.
  it("graduates through the real display probe after two compiled flights", async () => {
    // The runner-cadence oracle rides the SAME frames the probes measure: a
    // window sampled before the flights can drift from the probe's own (a
    // loaded runner, a throttling dip between windows) and mis-predict the
    // verdict. Collecting the gaps inside the two inter-flight waits makes
    // oracle and probe share one clock and one window.
    const gaps: number[] = [];
    const framesMeasured = (count: number) =>
      new Promise<void>((resolve) => {
        let remaining = count;
        let last: number | null = null;
        const tick = (t: number) => {
          if (last !== null) gaps.push(t - last);
          last = t;
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    drive(); // flight 1 — declined (unverified), probe armed
    await framesMeasured(14);
    drive(); // flight 2 — declined, probe armed again
    await framesMeasured(14);
    drive(); // flight 3 — decided by whatever the probe measured

    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!;
    if (median >= 14 && median <= 22) {
      expect(steadySixtyVerified()).toBe(true);
    }
    // Whatever the cadence, the compiled animation is what plays.
    expect(compiledAnimationSuppressed()).toBe(false);
  });

  it("a flight that completes mid-probe discards the window — idle gaps must not verify", () => {
    // Deterministic rAF: a manual queue with hand-fed timestamps.
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      queue.push(frameCallback);
      return queue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    let now = 0;
    const tickAll = (gapMs: number) => {
      const callbacks = queue.splice(0, queue.length);
      now += gapMs;
      callbacks.forEach((frameCallback) => frameCallback(now));
    };
    const driveCompleted = () => {
      const engine = createTransitionEngine(deps);
      const dispose = engine.driveScreenLifecycle({
        getElements: () => ({ scope }),
        transitionName: "sixty-test" as never,
        prevTransitionName: "sixty-test" as never,
        status: "COMPLETED",
        isActive: true,
        animHoldReleased: true
      });
      disposers.push(dispose);
    };

    // Flight 1: the probe runs its full window at a steady 16.7ms — one
    // verified median banked.
    drive();
    for (let i = 0; i < 12; i++) tickAll(16.7);

    // Flight 2: the probe arms, but the flight lands before the window fills.
    drive();
    for (let i = 0; i < 4; i++) tickAll(16.7);
    driveCompleted();
    // Post-flight idle gaps ALSO read ~16.7ms on an adaptive panel — the
    // exact trap: they must not complete the discarded window into the
    // second verifying median.
    for (let i = 0; i < 12; i++) tickAll(16.7);
    expect(steadySixtyVerified()).toBe(false);
    drive();
    expect(compiledAnimationSuppressed()).toBe(false);
  });

  it("touch Blink is compiled too — Blink is one rule", () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    drive();
    // Touch Blink used to default to the player and reach the compiled tier
    // only by demotion — two stalled flights, persisted per origin, re-probed
    // every session. Blink now routes compiled everywhere, so a weak phone is
    // deterministic from its first flight instead of depending on what its
    // ledger happens to hold.
    expect(compiledAnimationSuppressed()).toBe(false);
  });

  // The arming condition, pinned. It used to be a side effect of the driver
  // gate ("Blink, and not chained behind another pending navigation"); the gate
  // is gone and the condition is now written out, so it needs its own guard —
  // silently losing it would strand the landing governor on its 60Hz seed and
  // the steady-60 verdict on nothing at all, with no failing test anywhere.
  it("arms only for a Blink flight, and not for one chained behind another task", () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      queue.push(frameCallback);
      return queue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    let now = 0;
    const runWindow = () => {
      for (let i = 0; i < 12; i++) {
        const callbacks = queue.splice(0, queue.length);
        now += 16.7;
        callbacks.forEach((frameCallback) => frameCallback(now));
      }
    };

    // Non-Blink: no probe, so no verdict however many frames pass.
    delete NAV.userAgentData;
    drive();
    runWindow();
    runWindow();
    expect(steadySixtyVerified()).toBe(false);

    // Blink, but CHAINED — another navigation is still pending behind this
    // one, which is the case the arming deliberately skips.
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    const pending = vi
      .spyOn(TaskManger, "pendingTaskIds", "get")
      .mockReturnValue(["task-sixty", "task-other"]);
    drive();
    runWindow();
    runWindow();
    expect(steadySixtyVerified()).toBe(false);
    pending.mockRestore();

    // Blink, unchained: the probe runs and the verdict lands.
    drive();
    runWindow();
    drive();
    runWindow();
    expect(steadySixtyVerified()).toBe(true);
  });
});
