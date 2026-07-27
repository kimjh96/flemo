import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import { animationName } from "@transition/compileTransitionStyles";
import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: the bottom-tab replace "single-frame cut" (iOS Safari, plen 1.6.8),
// now FIXED by cancel-resume liveness on every participant.
//
// A tab switch is `replace(path, undefined, { transitionName })` at depth 1: the
// leftover top (REPLACING-false, exiting) and the fresh entering screen
// (REPLACING-true) crossfade for 150ms. The entering screen's feed SUSPENDS
// during its mount render; the DelayedSkeleton fallback commit invalidates the
// screens' compositor layers on WebKit, silently cancelling BOTH running CSS
// animations (fires animationcancel, no animationend).
//
// The engine used to wire recovery ONLY on the active screen, and spent its one
// restart on the first cancel so a rapid second cancel resolved the task early —
// two defects that turned the WebKit cancel into a user-visible single-frame cut:
//   1. the PASSIVE (exit) screen's fade died unrecovered, and
//   2. the ACTIVE screen resolved on the second cancel (the suspended-mount
//      churn), driving COMPLETED and cutting the leftover before either fade
//      painted a frame.
// Both sides now RESUME a browser-cancelled fade on its original timeline, up to
// the 4-per-transition budget, so the crossfade survives the churn.
//
// A crossfade whose enter AND exit variants are both non-player-drivable
// (mismatched clipPath templates, like createTransitionEngine.test.ts) so BOTH
// the active and passive sides take the compiled-CSS path — the path the
// recovery guards, and the path the affected device uses.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`));
afterAll(() => sessionStorage.removeItem("flemo:motion-driver-force"));

const TAB = "tab-forward" as never;

const crossfade = createTransition({
  name: TAB,
  // REPLACING-true from = initial; to = enter. Mismatched clipPath → CSS path.
  initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
  // REPLACING-false from = IDLE-true value; to = exit. Give idle a clipPath so
  // the exit's differently-shaped inset mismatches it → CSS path on the passive
  // side too (a pure-x exit would otherwise be player-drivable).
  idle: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0 } },
  enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.15 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.15 } },
  exit: { value: { x: "-1%", clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.15 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.15 } }
});

const ACTIVE_ANIM = animationName("screen", "tab-forward", "REPLACING-true");
const PASSIVE_ANIM = animationName("screen", "tab-forward", "REPLACING-false");

const newDiv = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

const cancelEvent = (name: string) => {
  const event = new Event("animationcancel");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};
const endEvent = (name: string) => {
  const event = new Event("animationend");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};

describe("replace suspended-mount cut", () => {
  let deps: TransitionEngineDeps;
  let resolveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    transitionMap.set(TAB, crossfade);
    deps = {
      // Both screens of the one replace share the scope's navigate store, so
      // both read the SAME in-flight task id.
      getTransitionTaskId: vi.fn(() => "task-replace"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
  });

  afterEach(() => {
    transitionMap.delete(TAB);
    resolveSpy.mockRestore();
    vi.useRealTimers();
  });

  const driveActive = (scope: HTMLElement) =>
    createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: TAB,
      prevTransitionName: TAB,
      status: "REPLACING",
      isActive: true,
      animHoldReleased: true
    });

  const drivePassive = (scope: HTMLElement) =>
    createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: TAB,
      prevTransitionName: TAB,
      status: "REPLACING",
      isActive: false,
      animHoldReleased: true
    });

  // ── The exit (passive) fade now recovers exactly like the enter fade ──

  it("the exit fade survives a WebKit cancel (restart trick runs, nothing resolves)", () => {
    const passive = newDiv();
    const removeSpy = vi.spyOn(passive.style, "removeProperty");
    const dispose = drivePassive(passive);

    // The passive side now wires cancel-resume: a lost exit animation is
    // resumed just as the active one is, so the crossfade's exit half is not
    // silently dropped. Passive has no task, so it never resolves.
    passive.dispatchEvent(cancelEvent(PASSIVE_ANIM));
    expect(removeSpy).toHaveBeenCalledWith("animation");
    expect(resolveSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
    passive.remove();
  });

  it("a rapid second cancel resumes again — it never resolves the task before frames play", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    // The two cancels are the suspended mount + its fallback commit, landing
    // within one paint. The engine resumes both times (budget 4) and never
    // resolves on the churn, so the crossfade is not cut to a single-frame snap.
    scope.dispatchEvent(cancelEvent(ACTIVE_ANIM));
    scope.dispatchEvent(cancelEvent(ACTIVE_ANIM));
    expect(resolveSpy).not.toHaveBeenCalled();

    dispose();
    scope.remove();
  });

  it("the active scope resumes up to the budget, then resolves on the next cancel", () => {
    const scope = newDiv();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = driveActive(scope);

    for (let i = 0; i < 4; i++) {
      scope.dispatchEvent(cancelEvent(ACTIVE_ANIM));
      expect(resolveSpy).not.toHaveBeenCalled();
    }
    expect(removeSpy).toHaveBeenCalledTimes(4);

    // 5th cancel: budget spent → resolve (bounded degradation, after 4 resumes).
    scope.dispatchEvent(cancelEvent(ACTIVE_ANIM));
    expect(resolveSpy).toHaveBeenCalledWith("task-replace");

    removeSpy.mockRestore();
    dispose();
    scope.remove();
  });

  it("the passive scope resumes up to the budget, then stops silently (never resolves)", () => {
    const scope = newDiv();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = drivePassive(scope);

    for (let i = 0; i < 4; i++) scope.dispatchEvent(cancelEvent(PASSIVE_ANIM));
    expect(removeSpy).toHaveBeenCalledTimes(4);

    // 5th cancel: budget spent → the passive side just stops, resolving nothing.
    scope.dispatchEvent(cancelEvent(PASSIVE_ANIM));
    expect(removeSpy).toHaveBeenCalledTimes(4);
    expect(resolveSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
    scope.remove();
  });

  it("CONTRAST: with no suspense churn the active fade runs to animationend and resolves once", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    // The healthy path: the compiled animation plays and ends normally.
    scope.dispatchEvent(endEvent(ACTIVE_ANIM));
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith("task-replace");

    dispose();
    scope.remove();
  });
});
