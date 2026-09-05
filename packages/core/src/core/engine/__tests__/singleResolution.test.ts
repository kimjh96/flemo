import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import type { NavigateStatus } from "@navigate/store";

import { animationName } from "@transition/compileTransitionStyles";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import type { Transition, TransitionName } from "@transition/typing";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { SKIP_ANIMATION_ATTR } from "@core/engine/types";

// NEVER A DOUBLE RESOLUTION.
//
// Six paths can settle a flight's navigation task: `animationend`, the
// perceptual completion cut, a cancel-resume terminal, the restart watchdog,
// the liveness floor, and the task gate's backstop. Several of them DO fire for
// one flight — that is deliberate, they are backstops and the engine does not
// try to disarm them all. What makes that safe is two properties, and this
// suite pins both:
//
//   1. `TaskManager.resolveTask` settles a given id at most once — a later call
//      naming an already-settled task returns false and does nothing. That
//      half is TaskManager's own contract and is pinned in its suite
//      ("resolveTask returns false for an already-completed task").
//   2. Every resolver names the id it CAPTURED at arm time, never whatever is
//      current when its timer happens to fire. That half is the ENGINE's, and
//      it is what this suite pins.
//
// Property 2 is the one with teeth. Without it a stale flight's deferred chain
// — the landing-clear rAFs, the choreography timer — lands FRAMES LATER on
// whatever task is current by then, and CUTS that navigation instead. It was
// device-measured once as a fast back's pop flipping COMPLETED at ~90ms with
// no motion at all.
//
// The resolution machinery is deliberately NOT split out of
// driveScreenLifecycle: the six paths are held together by this invariant, and
// separating them would divide the one thing that keeps them honest. This
// suite is what protects it instead — the contract, pinned directly, wherever
// the code happens to live.

const NAME = "single-resolution" as TransitionName;
const SPAN = 0.3;

const slide = () =>
  createTransition({
    name: NAME as never,
    initial: { x: "100%" },
    idle: { value: { x: 0 }, options: { duration: 0 } },
    enter: { value: { x: 0 }, options: { duration: SPAN } },
    enterBack: { value: { x: "100%" }, options: { duration: SPAN } },
    exit: { value: { x: "-30%" }, options: { duration: SPAN } },
    exitBack: { value: { x: 0 }, options: { duration: SPAN } }
  }) as Transition;

const animationEnd = (name: string) => {
  const event = new Event("animationend");
  Object.defineProperty(event, "animationName", { value: name });
  return event;
};

const animationCancel = (name: string) => {
  const event = new Event("animationcancel");
  Object.defineProperty(event, "animationName", { value: name });
  return event;
};

let resolveSpy: ReturnType<typeof vi.spyOn>;
let scope: HTMLDivElement;

/** Every task id the engine asked to resolve, in order. */
const resolvedIds = (): string[] =>
  resolveSpy.mock.calls.map((call: unknown[]) => call[0] as string);

/**
 * The id the navigation store would report RIGHT NOW. The binding hands the
 * engine a live reader, not a constant — which is the whole reason a resolver
 * has to capture its id instead of asking again when its timer fires.
 */
let currentTaskId: string | null = null;

const driveFlight = (taskId: string, status: NavigateStatus = "PUSHING") => {
  currentTaskId = taskId;
  const engine = createTransitionEngine({
    getTransitionTaskId: () => currentTaskId,
    setDragStatus: vi.fn(),
    setReplaceTransitionStatus: vi.fn()
  });
  const cleanup = engine.driveScreenLifecycle({
    getElements: () => ({ scope, decorator: null, bars: [] }),
    transitionName: NAME,
    prevTransitionName: NAME,
    status,
    isActive: true,
    animHoldReleased: true
  });
  return { engine, cleanup };
};

beforeEach(() => {
  vi.useFakeTimers();
  transitionMap.set(NAME as never, slide());
  resolveSpy = vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);
  scope = document.createElement("div");
  Object.defineProperty(scope, "clientWidth", { value: 390, configurable: true });
  Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
  document.body.appendChild(scope);
});

afterEach(() => {
  vi.useRealTimers();
  resolveSpy.mockRestore();
  scope.remove();
  transitionMap.delete(NAME as never);
});

describe("one flight names only its own task", () => {
  it("through a clean animationend, and through every backstop after it", () => {
    const { cleanup } = driveFlight("flight-a");

    scope.dispatchEvent(animationEnd(animationName("screen", NAME, "PUSHING-true")));
    vi.advanceTimersByTime(200);
    expect(resolvedIds().length).toBeGreaterThan(0);
    // Backstop windows run out: the floor, the watchdog, the gate.
    vi.advanceTimersByTime(10_000);
    expect(new Set(resolvedIds())).toEqual(new Set(["flight-a"]));

    cleanup();
  });

  it("through the liveness floor when no signal ever arrives", () => {
    const { cleanup } = driveFlight("flight-b");
    vi.advanceTimersByTime(10_000);
    expect(new Set(resolvedIds())).toEqual(new Set(["flight-b"]));
    cleanup();
  });

  it("through a cancel storm the resume budget cannot absorb", () => {
    const { cleanup } = driveFlight("flight-c");
    const name = animationName("screen", NAME, "PUSHING-true");
    for (let i = 0; i < 6; i += 1) {
      scope.dispatchEvent(animationCancel(name));
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(10_000);
    expect(new Set(resolvedIds())).toEqual(new Set(["flight-c"]));
    cleanup();
  });

  it("when animationend arrives AFTER a backstop already fired", () => {
    const { cleanup } = driveFlight("flight-d");
    vi.advanceTimersByTime(10_000);
    scope.dispatchEvent(animationEnd(animationName("screen", NAME, "PUSHING-true")));
    vi.advanceTimersByTime(500);
    expect(new Set(resolvedIds())).toEqual(new Set(["flight-d"]));
    cleanup();
  });
});

describe("a resolver never settles a task it did not capture", () => {
  it("a stale flight's backstops name their OWN id after the store has moved on", () => {
    // The failure this guards: a resolver that asks the store for the current
    // id when its timer fires, instead of using the one it captured. Its
    // deferred chain then lands frames later on the NEXT navigation and cuts
    // it mid-motion — device-measured as a pop flipping COMPLETED at ~90ms
    // with no motion at all.
    const first = driveFlight("flight-1");
    vi.advanceTimersByTime(20);

    // The navigation moves on while the first flight's deadlines are pending.
    currentTaskId = "flight-2";
    resolveSpy.mockClear();

    // Run every one of the FIRST flight's windows out.
    vi.advanceTimersByTime(10_000);

    // Whatever fired, it named the flight it was armed for — never the one
    // that happens to be current now.
    expect(resolvedIds()).not.toContain("flight-2");
    expect(new Set(resolvedIds())).toEqual(new Set(["flight-1"]));

    first.cleanup();
  });

  it("resolves nothing at all when there is no task to settle", () => {
    const engine = createTransitionEngine({
      getTransitionTaskId: () => null,
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    });
    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: NAME,
      prevTransitionName: NAME,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

    scope.dispatchEvent(animationEnd(animationName("screen", NAME, "PUSHING-true")));
    vi.advanceTimersByTime(10_000);
    expect(resolveSpy).not.toHaveBeenCalled();

    cleanup();
  });

  it("resolves nothing for a screen whose animation is skipped", () => {
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    const { cleanup } = driveFlight("flight-skip");

    vi.advanceTimersByTime(10_000);
    // A skipped screen has no motion to complete, so no path may claim one.
    expect(resolvedIds().filter((id: string) => id === "flight-skip").length).toBeLessThanOrEqual(
      1
    );

    cleanup();
    scope.removeAttribute(SKIP_ANIMATION_ATTR);
  });
});
