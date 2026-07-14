import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import none from "@transition/none";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { SKIP_ANIMATION_ATTR, type TransitionEngineDeps } from "@core/engine/types";

// jsdom reads as non-Blink (no navigator.userAgentData), where the player
// defaults OFF; these suites exercise the player paths, so pin it on via
// the diagnostic force key.
beforeAll(() => localStorage.setItem("flemo:motion-driver-force", "raf"));
afterAll(() => localStorage.removeItem("flemo:motion-driver-force"));

// A transition whose enter variant actually animates (duration > 0), so
// `PUSHING-true` reports an animation and the engine waits for animationend.
// The mismatched clipPath templates ("inset(0 0 0 100%)" vs "inset(0)") make
// this variant non-player-drivable on purpose: these tests exercise the CSS
// animation path (animationend contract), which such variants keep.
const animated = createTransition({
  name: "engine-test" as never,
  initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const newDiv = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

const animationEndEvent = (name: string) => {
  const event = new Event("animationend");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};

const animationCancelEvent = (name: string) => {
  const event = new Event("animationcancel");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};

describe("createTransitionEngine.driveScreenLifecycle", () => {
  let deps: TransitionEngineDeps;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let scope: HTMLDivElement;

  beforeEach(() => {
    transitionMap.set("engine-test" as never, animated);
    transitionMap.set("none", none);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-1"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    scope = newDiv();
  });

  afterEach(() => {
    scope.remove();
    transitionMap.delete("engine-test" as never);
    resolveSpy.mockRestore();
    vi.useRealTimers();
  });

  const drive = (
    overrides: Partial<
      Parameters<ReturnType<typeof createTransitionEngine>["driveScreenLifecycle"]>[0]
    > & {
      elements?: {
        scope: HTMLElement | null;
        decorator?: HTMLElement | null;
        bars?: (HTMLElement | null)[];
      };
    } = {}
  ) => {
    const engine = createTransitionEngine(deps);
    const { elements, ...rest } = overrides;
    return engine.driveScreenLifecycle({
      getElements: () => elements ?? { scope },
      transitionName: "engine-test" as never,
      prevTransitionName: "engine-test" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true,
      ...rest
    });
  };

  it("flips replace-transition status for a prev screen entering a differently-transitioned replace", () => {
    drive({
      isActive: false,
      status: "REPLACING",
      transitionName: "a" as never,
      prevTransitionName: "b" as never
    });
    expect(vi.mocked(deps.setReplaceTransitionStatus)).toHaveBeenCalledWith("PENDING");
  });

  it("does nothing for an inactive screen outside a differing replace", () => {
    drive({ isActive: false, status: "PUSHING" });
    expect(vi.mocked(deps.setReplaceTransitionStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(deps.setDragStatus)).not.toHaveBeenCalled();
  });

  it("resolves drag/replace and strips inline styles on COMPLETED", () => {
    const decorator = newDiv();
    const bar = newDiv();
    scope.style.transform = "translateX(20px)";
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    decorator.style.transform = "translateX(20px)";
    bar.style.setProperty("will-change", "transform");

    drive({ status: "COMPLETED", elements: { scope, decorator, bars: [bar] } });

    expect(vi.mocked(deps.setDragStatus)).toHaveBeenCalledWith("IDLE");
    expect(vi.mocked(deps.setReplaceTransitionStatus)).toHaveBeenCalledWith("IDLE");
    expect(scope.style.transform).toBe("");
    expect(scope.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
    expect(decorator.style.transform).toBe("");
    expect(bar.style.getPropertyValue("will-change")).toBe("");

    decorator.remove();
    bar.remove();
  });

  it("is a no-op on IDLE", () => {
    const dispose = drive({ status: "IDLE" });
    expect(vi.mocked(deps.setDragStatus)).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();
    dispose();
  });

  it("resolves the task on the matching animationend and ignores others", () => {
    const dispose = drive({ status: "PUSHING" });

    scope.dispatchEvent(animationEndEvent("some-other-animation"));
    expect(resolveSpy).not.toHaveBeenCalled();

    scope.dispatchEvent(animationEndEvent("flemo-screen-engine-test-PUSHING-true"));
    expect(vi.mocked(deps.getTransitionTaskId)).toHaveBeenCalled();
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    dispose();
  });

  it("resolves on a microtask when the variant has no animation (skip flag)", async () => {
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    drive({ status: "PUSHING" });
    expect(resolveSpy).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(resolveSpy).toHaveBeenCalledWith("task-1");
  });

  it("the liveness floor resolves the captured task when nothing else ever fires", () => {
    vi.useFakeTimers();
    const dispose = drive({ status: "PUSHING" });
    expect(resolveSpy).not.toHaveBeenCalled();

    // settleMs = (delay 0 + duration 0.3) * 1000 + the 1500ms margin.
    vi.advanceTimersByTime(1800);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");
    dispose();
  });

  it("disposer detaches the animationend listener", () => {
    const dispose = drive({ status: "PUSHING" });
    dispose();
    scope.dispatchEvent(animationEndEvent("flemo-screen-engine-test-PUSHING-true"));
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  // ── Part 2: animation-signal loss recovery (compiled-CSS path) ────────────
  // The `animated` transition (mismatched clipPath templates, no WAAPI in
  // jsdom) always takes the compiled-CSS path, so the engine wires the
  // animationcancel + watchdog recovery here. `flemo-screen-engine-test-…` is
  // the compiled screen animation name (see animationName()).
  const SCREEN_ANIM = "flemo-screen-engine-test-PUSHING-true";

  it("restarts a cancelled screen animation once, then resolves on the restart's animationend", () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    // A data/suspense commit cancels the animation mid-flight; no animationend
    // ever comes for it. The engine restarts it rather than resolve early.
    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));
    expect(removeSpy).toHaveBeenCalledWith("animation"); // restart trick ran
    expect(scope.style.animation).toBe(""); // left the compiled rule live again
    expect(resolveSpy).not.toHaveBeenCalled(); // restarted, did NOT resolve

    // The restarted animation ends normally → the task resolves.
    scope.dispatchEvent(animationEndEvent(SCREEN_ANIM));
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    removeSpy.mockRestore();
    dispose();
  });

  it("resolves immediately when the animation is cancelled again (restart budget spent)", () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM)); // 1st: restart
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledTimes(1);

    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM)); // 2nd: budget spent
    expect(removeSpy).toHaveBeenCalledTimes(1); // no second restart
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    removeSpy.mockRestore();
    dispose();
  });

  it("ignores animationcancel from other elements / other animation names", () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    scope.dispatchEvent(animationCancelEvent("some-other-animation"));
    const child = document.createElement("div");
    scope.appendChild(child);
    const bubbling = new Event("animationcancel", { bubbles: true });
    Object.defineProperty(bubbling, "animationName", { value: SCREEN_ANIM });
    child.dispatchEvent(bubbling);

    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
  });

  it("watchdog restarts once at duration+delay+250ms, then resolves at the next deadline", () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = drive({ status: "PUSHING" });

    // Deadline = (delay 0 + duration 0.3) * 1000 + 250 = 550ms.
    vi.advanceTimersByTime(549);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // 550 → first watchdog: restart + re-arm
    expect(removeSpy).toHaveBeenCalledWith("animation");
    expect(resolveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(549);
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); // 1100 → second watchdog: budget spent → resolve
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    removeSpy.mockRestore();
    dispose();
  });

  it("arms no watchdog while the anim-hold is unreleased (a paused animation is not lost)", () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = drive({ status: "PUSHING", animHoldReleased: false });

    // Past the watchdog deadline (550ms) but before the liveness floor
    // (1800ms): a held, paused animation must be neither restarted nor resolved.
    vi.advanceTimersByTime(1000);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
  });

  it("clears the watchdog on a normal animationend (no restart, no double-resolve)", () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = drive({ status: "PUSHING" });

    vi.advanceTimersByTime(200);
    scope.dispatchEvent(animationEndEvent(SCREEN_ANIM));
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    // Past the watchdog deadline + its would-be re-arm, but before the 1800ms
    // floor: the cleared watchdog neither restarts nor resolves a second time.
    vi.advanceTimersByTime(1300); // total 1500ms
    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    removeSpy.mockRestore();
    dispose();
  });

  it("does not double-arm the watchdog when the anim-hold release re-runs the effect", () => {
    vi.useFakeTimers();
    const engine = createTransitionEngine(deps);
    const input = (animHoldReleased: boolean) => ({
      getElements: () => ({ scope }),
      transitionName: "engine-test" as never,
      prevTransitionName: "engine-test" as never,
      status: "PUSHING" as const,
      isActive: true,
      animHoldReleased
    });

    // Held run arms nothing; React then re-runs the effect on release: the held
    // run's cleanup fires first, so the released run arms exactly ONE watchdog.
    const disposeHeld = engine.driveScreenLifecycle(input(false));
    disposeHeld();
    const disposeReleased = engine.driveScreenLifecycle(input(true));

    // One watchdog: restart at 550, resolve at 1100. A double-arm would spend
    // the budget in the same tick and resolve at 550 instead.
    vi.advanceTimersByTime(550);
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(550);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    disposeReleased();
  });

  it("does not restart when SKIP_ANIMATION is set mid-flight; resolves immediately", () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    // A swipe commits the exit and marks the scope skip-animation after setup.
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));

    expect(removeSpy).not.toHaveBeenCalled(); // no restart trick
    expect(resolveSpy).toHaveBeenCalledWith("task-1"); // resolved immediately

    removeSpy.mockRestore();
    dispose();
  });

  it("recovery is a no-op when there is no transition task id to gate", () => {
    const engine = createTransitionEngine({
      getTransitionTaskId: () => null,
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "engine-test" as never,
      prevTransitionName: "engine-test" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));
    expect(removeSpy).not.toHaveBeenCalled(); // nothing to restart
    expect(resolveSpy).not.toHaveBeenCalled(); // nothing to resolve

    removeSpy.mockRestore();
    dispose();
  });

  it("does not wire the recovery when the rAF player drives the active screen", () => {
    // A player-drivable variant (pure x → the numeric tier joins in jsdom)
    // hands motion to the player: its onComplete + the floor own liveness, and
    // wiring animationcancel would catch the join's own `animation: none`. So a
    // cancel here must NOT trigger the restart trick.
    const player = document.createElement("div");
    document.body.appendChild(player);
    transitionMap.set(
      "player-drivable" as never,
      createTransition({
        name: "player-drivable" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.3 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
        exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
      })
    );
    const removeSpy = vi.spyOn(player.style, "removeProperty");
    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope: player }),
      transitionName: "player-drivable" as never,
      prevTransitionName: "player-drivable" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

    // The player joined and suppressed the compiled animation.
    expect(player.style.animation).toBe("none");
    player.dispatchEvent(animationCancelEvent("flemo-screen-player-drivable-PUSHING-true"));
    expect(removeSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
    player.remove();
    transitionMap.delete("player-drivable" as never);
  });
});
