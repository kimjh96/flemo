import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import none from "@transition/none";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { SKIP_ANIMATION_ATTR, type TransitionEngineDeps } from "@core/engine/types";

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
});
