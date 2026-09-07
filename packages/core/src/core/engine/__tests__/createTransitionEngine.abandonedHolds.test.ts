import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { flightWindowActive } from "@core/engine/flightWindow";

import type { TransitionEngineDeps } from "@core/engine/types";

// THE HOLDS A SCREEN NEVER CAME BACK TO RELEASE.
//
// Every hold `flightHolds` arms is handed back by a LATER drive pass: the one
// where the screen leaves the statuses that justified it. A screen that
// unmounts mid-flight never has one, and two of those holds are not the
// screen's to take with it — the response park and the flight window are
// session-global latches, and the window is a refcount with no timer behind
// it. Measured at the engine, with timers and rAF flushed after each step:
//
//   during the flight          window open
//   PUSHING -> COMPLETED       window closed
//   PUSHING -> unmount         window OPEN, and it stays that way
//
// It gates the image decode offloader and the layer settle hold, so a page
// that has leaked one defers image reveals and layer demotions for the rest of
// the session with nothing in the air.
//
// The other half of this file is the failure mode the fix must not have. A
// cleanup runs on every effect RE-RUN as well as on unmount, and releasing the
// arrival armor between two passes of the same flight would be worse than the
// leak it fixes.

const animated = createTransition({
  name: "abandoned-holds-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

/** Let a scheduled landing, and the teardown's own microtask, actually run. */
const settle = async () => {
  for (let index = 0; index < 6; index++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }
};

describe("holds a screen leaves behind", () => {
  let root: HTMLElement;
  let scope: HTMLElement;
  let engine: ReturnType<typeof createTransitionEngine>;
  let resolveSpy: ReturnType<typeof vi.spyOn>;

  const drive = (status: "PUSHING" | "COMPLETED", animHoldReleased = false) =>
    engine.driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "abandoned-holds-test" as never,
      prevTransitionName: "abandoned-holds-test" as never,
      status,
      isActive: true,
      animHoldReleased
    });

  beforeEach(() => {
    transitionMap.set("abandoned-holds-test" as never, animated);
    resolveSpy = vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);

    root = document.createElement("div");
    root.setAttribute("data-flemo-router", "router-holds");
    scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "screen-1");
    scope.setAttribute("data-flemo-transition", "abandoned-holds-test");
    root.appendChild(scope);
    document.body.appendChild(root);

    engine = createTransitionEngine({
      getTransitionTaskId: vi.fn(() => "task-abandoned-holds"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    } as unknown as TransitionEngineDeps);
  });

  afterEach(async () => {
    root.remove();
    await settle();
    transitionMap.delete("abandoned-holds-test" as never);
    resolveSpy.mockRestore();
  });

  it("closes the global window when the screen goes away mid-flight", async () => {
    const dispose = drive("PUSHING");
    expect(flightWindowActive()).toBe(true);

    // The unmount: the node leaves and the effect is cleaned up. No COMPLETED
    // pass ever runs, which is the whole point.
    scope.remove();
    dispose();
    await settle();

    expect(flightWindowActive()).toBe(false);
  });

  it("keeps holding across a re-run, which is not a screen going away", async () => {
    const first = drive("PUSHING");
    expect(flightWindowActive()).toBe(true);

    // What React does on every commit of the same flight: clean up the
    // previous pass, then run the next one. The screen stays in the document.
    first();
    const second = drive("PUSHING");
    await settle();

    // Still armed. Letting go here would land the arrival armor in the middle
    // of the flight it exists to shield.
    expect(flightWindowActive()).toBe(true);

    scope.remove();
    second();
    await settle();
    expect(flightWindowActive()).toBe(false);
  });

  it("survives a host with no microtask queue to check on", async () => {
    // The deferred check is how a re-run is told from an unmount. Without one,
    // the synchronous check is all there is: a screen still in the document is
    // left holding, which is the safe half of the answer.
    vi.stubGlobal("queueMicrotask", undefined);
    const dispose = drive("PUSHING");

    expect(() => dispose()).not.toThrow();
    expect(flightWindowActive()).toBe(true);

    vi.unstubAllGlobals();
    scope.remove();
    drive("PUSHING")();
    await settle();
    expect(flightWindowActive()).toBe(false);
  });

  it("still closes it when the flight completes the ordinary way", async () => {
    const pushing = drive("PUSHING");
    const completed = drive("COMPLETED", true);
    await settle();

    expect(flightWindowActive()).toBe(false);

    pushing();
    completed();
  });
});
