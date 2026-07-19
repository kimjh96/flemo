import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";

import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// The compositor-trail grace: on non-Blink engines (jsdom reads as one — no
// navigator.userAgentData) a CLEAN animationend defers the task resolution
// by COMPOSITOR_TRAIL_GRACE_MS, so a compositor whose copy of the fade
// started a few frames late finishes presenting the tail before the
// COMPLETED restructure cancels the animation. Captured on device glass as
// the landed screen sitting washed-out (~55% presented) for a beat, then
// snapping to full contrast. The other engine suites stub userAgentData to
// run as Blink (grace 0); THIS suite runs bare jsdom on purpose.

const animated = createTransition({
  name: "grace-test" as never,
  initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const animationEndEvent = (name: string) => {
  const event = new Event("animationend");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};

describe("compositor-trail grace (non-Blink clean landing)", () => {
  let deps: TransitionEngineDeps;
  let scope: HTMLElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    transitionMap.set("grace-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-1"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    scope = document.createElement("div");
    document.body.appendChild(scope);
  });

  afterEach(() => {
    scope.remove();
    transitionMap.delete("grace-test" as never);
    resolveSpy.mockRestore();
    vi.useRealTimers();
  });

  const drive = () =>
    createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "grace-test" as never,
      prevTransitionName: "grace-test" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

  it("holds a clean animationend for the grace, then resolves once", () => {
    const dispose = drive();

    scope.dispatchEvent(animationEndEvent("flemo-screen-grace-test-PUSHING-true"));
    // The main thread's clock says the fade is over; the compositor may not.
    // The COMPLETED restructure must wait out the trail.
    expect(resolveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(159);
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    dispose();
  });

  it("a teardown during the grace cancels the deferred resolve (the floor still covers liveness)", () => {
    const dispose = drive();
    scope.dispatchEvent(animationEndEvent("flemo-screen-grace-test-PUSHING-true"));
    dispose();
    vi.advanceTimersByTime(200);
    // The deferred clean resolve was cancelled with the drive; the liveness
    // floor (motion span + margin) remains the backstop on a live drive.
    expect(resolveSpy).not.toHaveBeenCalled();
  });
});
