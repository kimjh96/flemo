import { describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { MORPH_CAMERA_ATTR } from "@dom/attributes";

// jsdom reads as non-Blink with no touch points, so this suite exercises the
// COMPILED path — the only motion driver the engine has.

const deps = () => ({
  getTransitionTaskId: vi.fn(() => null),
  setDragStatus: vi.fn(),
  setReplaceTransitionStatus: vi.fn()
});

// jsdom carries no Web Animations timeline, so model the camera's running
// animation with the exact shape the engine reads off getAnimations(): an
// `animationName` and an `effect.getTiming()` yielding delay + duration in ms.
const cameraAnimation = (animationName: string | undefined, delay: number, duration: number) =>
  ({
    animationName,
    effect: { getTiming: () => ({ delay, duration }) }
  }) as unknown as Animation;

describe("a still screen paired with a morph camera spans the camera's motion", () => {
  it("defers completion to the camera's span when the screen's own transition is motionless", async () => {
    vi.useFakeTimers();
    const resolveSpy = vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);
    const anchored = vi.spyOn(TaskManager, "anchorGate");

    // A `zoom`-shaped transition: the screen stands still (enter/exit animate
    // nothing) while the camera carrying it does the motion.
    transitionMap.set(
      "camera-still" as never,
      createTransition({
        name: "camera-still" as never,
        initial: { x: 0 },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0 } },
        enterBack: { value: { x: 0 }, options: { duration: 0 } },
        exit: { value: { x: 0 }, options: { duration: 0 } },
        exitBack: { value: { x: 0 }, options: { duration: 0 } }
      })
    );

    // The camera element lives in the same document as the screen scope; the
    // engine finds it by attribute off the scope's ownerDocument.
    const scope = document.createElement("div");
    const cameraEl = document.createElement("div");
    cameraEl.setAttribute(MORPH_CAMERA_ATTR, "morph-1c");
    document.body.append(scope, cameraEl);
    // Only the `-camera` suffixed animation counts: a sibling screen animation
    // is skipped, and an animation carrying no name falls back to "" and is
    // skipped too. Two camera animations exercise both `|| 0` timing fallbacks.
    cameraEl.getAnimations = () => [
      cameraAnimation("flemo-screen-camera-still-PUSHING-true", 0, 0),
      cameraAnimation("flemo-morph-morph-1-camera", 0, 400),
      cameraAnimation("flemo-morph-morph-1b-camera", 100, 0),
      cameraAnimation(undefined, 0, 999)
    ];

    try {
      const d = { ...deps(), getTransitionTaskId: vi.fn(() => "camera-task") };
      const engine = createTransitionEngine(d);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "camera-still" as never,
        prevTransitionName: "camera-still" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      // The gate is anchored on the camera span (400ms) + the arming margin
      // (50ms) + the recovery margin — never on the still screen's absent clock.
      expect(anchored).toHaveBeenCalledWith("camera-task", 400 + 50 + 1500);

      // Completion is deferred through the camera span, not resolved on a
      // microtask: still pending just before it lands, resolved right after.
      await vi.advanceTimersByTimeAsync(400);
      expect(resolveSpy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(50);
      expect(resolveSpy).toHaveBeenCalledWith("camera-task");

      cleanup();
    } finally {
      resolveSpy.mockRestore();
      anchored.mockRestore();
      scope.remove();
      cameraEl.remove();
      transitionMap.delete("camera-still" as never);
      vi.useRealTimers();
    }
  });
});
