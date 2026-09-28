import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { landingClearFrames } from "@core/engine/flightRouting";
import { MORPH_CAMERA_ATTR } from "@dom/attributes";

// A STILL screen's flight lands on its participants' real end, not on the
// wall-clock span. The span is armed at the release commit and the motion
// starts a frame or two after it, so the span carries a margin; landing on it
// held the last motion frame still for that margin before the COMPLETED flip
// repainted (traced on desktop Chrome: 40 to 70ms on every container
// transform). These pin both halves: the real end wins, and the span still
// backs up an end that never comes.

const deps = (taskId: string) => ({
  getTransitionTaskId: vi.fn(() => taskId),
  setDragStatus: vi.fn(),
  setReplaceTransitionStatus: vi.fn()
});

// The shape the engine reads: a camera-suffixed name and timing for the span,
// a finite computed end for the landing, and the finished promise it awaits.
const cameraAnimation = (durationMs: number) => {
  let finish!: () => void;
  let cancel!: () => void;
  const finished = new Promise<void>((resolve, reject) => {
    finish = resolve;
    cancel = () => reject(new DOMException("cancelled", "AbortError"));
  });
  const animation = {
    animationName: "flemo-morph-still-1-camera",
    effect: {
      getTiming: () => ({ delay: 0, duration: durationMs }),
      getComputedTiming: () => ({ endTime: durationMs })
    },
    finished
  } as unknown as Animation;
  return { animation, finish, cancel };
};

// A manual frame clock, so the test can count exactly how many frames the
// landing waits after the end.
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const runFrame = () => {
  const due = [...frames.entries()];
  frames.clear();
  for (const [, callback] of due) callback(0);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  frames = new Map();
  nextFrame = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  transitionMap.set(
    "still-landing" as never,
    createTransition({
      name: "still-landing" as never,
      initial: { x: 0 },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0 } },
      enterBack: { value: { x: 0 }, options: { duration: 0 } },
      exit: { value: { x: 0 }, options: { duration: 0 } },
      exitBack: { value: { x: 0 }, options: { duration: 0 } }
    })
  );
});

afterEach(() => {
  transitionMap.delete("still-landing" as never);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const drive = (taskId: string, durationMs: number) => {
  const resolveSpy = vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);
  const scope = document.createElement("div");
  const cameraEl = document.createElement("div");
  cameraEl.setAttribute(MORPH_CAMERA_ATTR, "still-1c");
  document.body.append(scope, cameraEl);
  const camera = cameraAnimation(durationMs);
  cameraEl.getAnimations = () => [camera.animation];
  const cleanup = createTransitionEngine(deps(taskId)).driveScreenLifecycle({
    getElements: () => ({ scope, decorator: null, bars: [] }),
    transitionName: "still-landing" as never,
    prevTransitionName: "still-landing" as never,
    status: "PUSHING",
    isActive: true,
    animHoldReleased: true
  });
  return { resolveSpy, camera, cleanup };
};

describe("a still screen's flight lands on its real end", () => {
  it("resolves the pipeline's frames after the camera finishes, before the span's margin", async () => {
    const { resolveSpy, camera, cleanup } = drive("still-task", 400);

    await vi.advanceTimersByTimeAsync(400);
    expect(resolveSpy).not.toHaveBeenCalled();

    camera.finish();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 1; i < landingClearFrames(); i++) {
      runFrame();
      expect(resolveSpy).not.toHaveBeenCalled();
    }
    runFrame();
    expect(resolveSpy).toHaveBeenCalledWith("still-task");

    // The span that would have landed it is gone: no second resolution.
    await vi.advanceTimersByTimeAsync(100);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("falls back to the span when the motion is cancelled instead of finishing", async () => {
    const { resolveSpy, camera, cleanup } = drive("cancelled-task", 400);

    camera.cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(frames.size).toBe(0);

    await vi.advanceTimersByTimeAsync(449);
    expect(resolveSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(resolveSpy).toHaveBeenCalledWith("cancelled-task");
    cleanup();
  });

  it("lands on the span when it comes first, and a later end does not land it again", async () => {
    const { resolveSpy, camera, cleanup } = drive("late-end-task", 400);

    await vi.advanceTimersByTimeAsync(450);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    camera.finish();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < landingClearFrames(); i++) runFrame();
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("lands nothing once the flight is torn down, even with the landing frames pending", async () => {
    const { resolveSpy, camera, cleanup } = drive("torn-task", 400);

    camera.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(frames.size).toBe(1);

    cleanup();
    expect(frames.size).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(resolveSpy).not.toHaveBeenCalled();
  });
});
