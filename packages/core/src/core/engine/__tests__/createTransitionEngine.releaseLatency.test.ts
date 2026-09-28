import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { learnedReleaseLatencyMs, resetReleaseLatencyForTests } from "@platform/releaseLatency";

// A flight's head is decided from the release latency this session has seen.
// The engine's effect runs at the staging commit (hold on) and again at the
// release, and a sample taken at the staging run measured a paused, parked
// frame: short enough that the release run dropped the head the staging run
// had put on, swapping every participant's animation at the release. Only the
// run that IS the release may report.

const SLIDE = "latency-slide" as never;

beforeEach(() => {
  resetReleaseLatencyForTests();
  vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(performance.now() + 5);
    return 1;
  });
  transitionMap.set(
    SLIDE,
    createTransition({
      name: SLIDE,
      initial: { x: "100%" },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0.3 } },
      enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
      exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
      exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
    })
  );
});

afterEach(() => {
  transitionMap.delete(SLIDE);
  resetReleaseLatencyForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const drive = (animHoldReleased: boolean) => {
  const scope = document.createElement("div");
  document.body.appendChild(scope);
  return createTransitionEngine({
    getTransitionTaskId: vi.fn(() => "latency-task"),
    setDragStatus: vi.fn(),
    setReplaceTransitionStatus: vi.fn()
  }).driveScreenLifecycle({
    getElements: () => ({ scope }),
    transitionName: SLIDE,
    prevTransitionName: SLIDE,
    status: "POPPING",
    isActive: true,
    animHoldReleased
  });
};

describe("the release latency a head is decided from", () => {
  it("is not sampled at the staging run, while the hold is still on", () => {
    const dispose = drive(false);
    expect(learnedReleaseLatencyMs("POPPING")).toBeNull();
    dispose();
  });

  it("is sampled at the release", () => {
    const dispose = drive(true);
    expect(learnedReleaseLatencyMs("POPPING")).toBeCloseTo(5, 0);
    dispose();
  });
});
