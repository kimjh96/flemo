import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { animationName } from "@transition/compileTransitionStyles";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { SKIP_ANIMATION_ATTR } from "@core/engine/types";
import createPartTransition from "@transition/partTransition/createPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// jsdom reads as non-Blink (no navigator.userAgentData), where the player
// defaults OFF; these suites exercise the player paths, so pin it on via
// the diagnostic force key.
beforeAll(() => sessionStorage.setItem("flemo:motion-driver-force", "raf"));
afterAll(() => sessionStorage.removeItem("flemo:motion-driver-force"));

const deps = () => ({
  getTransitionTaskId: vi.fn(() => null),
  setDragStatus: vi.fn(),
  setReplaceTransitionStatus: vi.fn()
});

const animationEndEvent = (name: string, bubbles = false) => {
  const event = new Event("animationend", { bubbles });
  Object.defineProperty(event, "animationName", { value: name });
  return event;
};

const elements = () => {
  const scope = document.createElement("div");
  const decorator = document.createElement("div");
  const bar = document.createElement("div");
  return { scope, decorator, bar };
};

describe("createTransitionEngine branches", () => {
  it("COMPLETED strips inline styles + skip markers from the scope, decorator, and bars", () => {
    const { scope, decorator, bar } = elements();
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    decorator.setAttribute(SKIP_ANIMATION_ATTR, "true");
    scope.style.transition = "none";
    bar.style.willChange = "transform";
    const d = deps();
    const engine = createTransitionEngine(d);

    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator, bars: [bar, null] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "COMPLETED",
      isActive: true,
      animHoldReleased: true
    });

    expect(scope.getAttribute(SKIP_ANIMATION_ATTR)).toBeNull();
    expect(decorator.getAttribute(SKIP_ANIMATION_ATTR)).toBeNull();
    expect(bar.style.willChange).toBe("");
    expect(d.setDragStatus).toHaveBeenCalledWith("IDLE");
    expect(d.setReplaceTransitionStatus).toHaveBeenCalledWith("IDLE");
    cleanup();
  });

  it("IDLE and a missing scope are no-ops", () => {
    const d = deps();
    const engine = createTransitionEngine(d);

    const idleCleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope: document.createElement("div"), decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "IDLE",
      isActive: true,
      animHoldReleased: true
    });
    idleCleanup();

    const noScopeCleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope: null, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    noScopeCleanup();

    expect(d.getTransitionTaskId).not.toHaveBeenCalled();
  });

  it("flags a prev screen entering a differently-transitioned replace as PENDING", () => {
    const d = deps();
    const engine = createTransitionEngine(d);

    engine.driveScreenLifecycle({
      getElements: () => ({ scope: null, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "material" as never,
      status: "REPLACING",
      isActive: false,
      animHoldReleased: true
    });

    expect(d.setReplaceTransitionStatus).toHaveBeenCalledWith("PENDING");
  });

  it("strips player-written inline styles from a PASSIVE screen at COMPLETED", () => {
    const { scope, decorator, bar } = elements();
    scope.style.transform = "translate3d(-490px, 0px, 0px)";
    decorator.style.opacity = "0.4";
    bar.style.transform = "translate3d(-490px, 0px, 0px)";
    const d = deps();
    const engine = createTransitionEngine(d);

    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator, bars: [bar, null] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "COMPLETED",
      isActive: false,
      animHoldReleased: true
    });

    expect(scope.style.transform).toBe("");
    expect(decorator.style.opacity).toBe("");
    expect(bar.style.transform).toBe("");
  });

  it("passive COMPLETED with no elements is a safe no-op", () => {
    const d = deps();
    const engine = createTransitionEngine(d);
    expect(() =>
      engine.driveScreenLifecycle({
        getElements: () => ({ scope: null, decorator: null, bars: [null] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "COMPLETED",
        isActive: false,
        animHoldReleased: true
      })
    ).not.toThrow();
  });

  it("a passive variant that animates nothing joins no player (motionless exit)", () => {
    const { scope } = elements();
    document.body.append(scope);
    const d = {
      getTransitionTaskId: vi.fn(() => "player-task"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    const engine = createTransitionEngine(d);

    // exit (PUSHING-false) has zero duration: resolveVariantMotion yields
    // null, so joinPlayer must decline instead of joining an empty track.
    transitionMap.set(
      "branches-still-exit" as never,
      createTransition({
        name: "branches-still-exit" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.3 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
        exit: { value: { x: "-35%" }, options: { duration: 0 } },
        exitBack: { value: { x: 0 }, options: { duration: 0 } }
      })
    );

    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "branches-still-exit" as never,
      prevTransitionName: "branches-still-exit" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true
    });

    expect(scope.style.animation).toBe("");
    cleanup();
    scope.remove();
    transitionMap.delete("branches-still-exit" as never);
  });

  it("an active screen with a motionless decorator variant joins only its scope", () => {
    const { scope, decorator } = elements();
    document.body.append(scope, decorator);
    const d = {
      getTransitionTaskId: vi.fn(() => "player-task"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    const engine = createTransitionEngine(d);

    // The overlay decorator's PUSHING-true variant is idle (zero duration):
    // the decorator resolves no motion and must simply not join.
    transitionMap.set(
      "branches-active-deco" as never,
      createTransition({
        name: "branches-active-deco" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.3 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
        exit: { value: { x: "-35%" }, options: { duration: 0.3 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.3 } },
        options: { decoratorName: "overlay" }
      })
    );

    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator, bars: [] }),
      transitionName: "branches-active-deco" as never,
      prevTransitionName: "branches-active-deco" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

    expect(scope.style.animation).toBe("none");
    expect(decorator.style.animation).toBe("");
    cleanup();
    scope.remove();
    decorator.remove();
    transitionMap.delete("branches-active-deco" as never);
  });

  it("this screen's <Part> elements join the player; nested screens' parts do not", () => {
    const container = document.createElement("div");
    const scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "true");
    // A part on this screen (in a bar, outside the scope), mirroring the
    // passive push variant.
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", "title-fade");
    part.setAttribute("data-flemo-status", "PUSHING");
    part.setAttribute("data-flemo-active", "false");
    // A nested screen's part with identical attributes: owned by another
    // engine, must be excluded.
    const nestedScreen = document.createElement("div");
    nestedScreen.setAttribute("data-flemo-screen", "true");
    const nestedPart = document.createElement("div");
    nestedPart.setAttribute("data-flemo-part-name", "title-fade");
    nestedPart.setAttribute("data-flemo-status", "PUSHING");
    nestedPart.setAttribute("data-flemo-active", "false");
    nestedScreen.appendChild(nestedPart);
    scope.appendChild(nestedScreen);
    container.append(scope, part);
    document.body.appendChild(container);

    partTransitionMap.set(
      "title-fade" as never,
      createPartTransition({
        name: "title-fade" as never,
        initial: { opacity: 1 },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 0 }, options: { duration: 0.3 } },
        exit: { value: { opacity: 1 }, options: { duration: 0.3 } }
      })
    );
    transitionMap.set(
      "branches-parts" as never,
      createTransition({
        name: "branches-parts" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.3 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
        exit: { value: { x: "-35%" }, options: { duration: 0.3 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
      })
    );

    const d = {
      getTransitionTaskId: vi.fn(() => "part-task"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    const engine = createTransitionEngine(d);
    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "branches-parts" as never,
      prevTransitionName: "branches-parts" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true
    });

    // The part joined (compiled animation suppressed, from-frame pinned);
    // the nested screen's part did not.
    expect(part.style.animation).toBe("none");
    expect(part.style.opacity).toBe("1");
    expect(nestedPart.style.animation).toBe("");

    cleanup();
    expect(part.style.animation).toBe("");

    container.remove();
    partTransitionMap.delete("title-fade" as never);
    transitionMap.delete("branches-parts" as never);
  });

  it("parts with no registered definition, a motionless variant, or a declined join stay on CSS", () => {
    const container = document.createElement("div");
    const scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "true");
    const partOf = (name: string) => {
      const part = document.createElement("div");
      part.setAttribute("data-flemo-part-name", name);
      part.setAttribute("data-flemo-status", "PUSHING");
      part.setAttribute("data-flemo-active", "false");
      return part;
    };
    const ghost = partOf("ghost"); // never registered
    const still = partOf("still-part"); // registered, but this variant is motionless
    const scrubless = partOf("scrubless-part"); // motion the player can't take in jsdom (no WAAPI)
    container.append(scope, ghost, still, scrubless);
    document.body.appendChild(container);

    partTransitionMap.set(
      "still-part" as never,
      createPartTransition({
        name: "still-part" as never,
        initial: { opacity: 1 },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 0 }, options: { duration: 0 } },
        exit: { value: { opacity: 1 }, options: { duration: 0 } }
      })
    );
    partTransitionMap.set(
      "scrubless-part" as never,
      createPartTransition({
        name: "scrubless-part" as never,
        initial: { clipPath: "inset(0 0 0 100%)" },
        idle: { value: { clipPath: "inset(0)" }, options: { duration: 0 } },
        enter: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.3 } },
        exit: { value: { clipPath: "inset(0)" }, options: { duration: 0.3 } }
      })
    );
    transitionMap.set(
      "branches-part-edges" as never,
      createTransition({
        name: "branches-part-edges" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.3 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
        exit: { value: { x: "-35%" }, options: { duration: 0.3 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
      })
    );

    const d = {
      getTransitionTaskId: vi.fn(() => "part-edge-task"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    const engine = createTransitionEngine(d);
    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "branches-part-edges" as never,
      prevTransitionName: "branches-part-edges" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true
    });

    // The screen joined; none of the three parts did (their compiled CSS
    // animations stay in charge), and none of them crashed the join.
    expect(scope.style.animation).toBe("none");
    expect(ghost.style.animation).toBe("");
    expect(still.style.animation).toBe("");
    expect(scrubless.style.animation).toBe("");

    cleanup();
    container.remove();
    partTransitionMap.delete("still-part" as never);
    partTransitionMap.delete("scrubless-part" as never);
    transitionMap.delete("branches-part-edges" as never);
  });

  it("COMPLETED strips this screen's part writes but not a nested screen's", () => {
    const container = document.createElement("div");
    const scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "true");
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", "title-fade");
    part.style.opacity = "0.4";
    const nestedScreen = document.createElement("div");
    nestedScreen.setAttribute("data-flemo-screen", "true");
    const nestedPart = document.createElement("div");
    nestedPart.setAttribute("data-flemo-part-name", "title-fade");
    nestedPart.style.opacity = "0.4";
    nestedScreen.appendChild(nestedPart);
    scope.appendChild(nestedScreen);
    container.append(scope, part);
    document.body.appendChild(container);

    const d = deps();
    const engine = createTransitionEngine(d);
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "COMPLETED",
      isActive: false,
      animHoldReleased: true
    });

    expect(part.style.opacity).toBe("");
    expect(nestedPart.style.opacity).toBe("0.4"); // the nested engine's job

    container.remove();
  });

  it("a passive transitional screen joins its riding bars and decorator to the player", () => {
    const { scope, decorator, bar } = elements();
    const ridingBar = document.createElement("div");
    ridingBar.setAttribute("data-flemo-bar-riding", "true");
    // The player only writes frames to CONNECTED elements.
    document.body.append(scope, decorator, bar, ridingBar);
    const d = {
      getTransitionTaskId: vi.fn(() => "player-task"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    const engine = createTransitionEngine(d);

    // Interpolable motion (x only) + the overlay decorator: the passive side
    // of a push joins the shared player with every participant.
    transitionMap.set(
      "branches-player" as never,
      createTransition({
        name: "branches-player" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.3 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
        exit: { value: { x: "-35%" }, options: { duration: 0.3 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.3 } },
        options: { decoratorName: "overlay" }
      })
    );

    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator, bars: [ridingBar, bar, null] }),
      transitionName: "branches-player" as never,
      prevTransitionName: "branches-player" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true
    });

    // The scope, the RIDING bar, and the decorator each pinned their from
    // frame and suppressed the compiled animation; the non-riding bar did not.
    expect(scope.style.animation).toBe("none");
    expect(ridingBar.style.animation).toBe("none");
    expect(bar.style.animation).toBe("");
    expect(decorator.style.animation).toBe("none");
    expect(decorator.style.opacity).toBe("0");

    // Detaching strips every participant's inline pin.
    cleanup();
    expect(scope.style.animation).toBe("");
    expect(ridingBar.style.animation).toBe("");
    expect(decorator.style.animation).toBe("");

    scope.remove();
    decorator.remove();
    bar.remove();
    ridingBar.remove();
    transitionMap.delete("branches-player" as never);
  });

  it("ignores animationend events from other elements or other animations", () => {
    const { scope } = elements();
    const d = deps();
    const engine = createTransitionEngine(d);

    // Mismatched clipPath templates force the CSS animation path — this test
    // verifies the animationend listener contract that path keeps.
    transitionMap.set(
      "branches-css" as never,
      createTransition({
        name: "branches-css" as never,
        initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.3 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
        exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
      })
    );

    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "branches-css" as never,
      prevTransitionName: "branches-css" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

    // The liveness floor reads the task id ONCE at setup. Baseline it, then the
    // WRONG animationend events must add NO further reads (they must not resolve).
    const baseline = (d.getTransitionTaskId as ReturnType<typeof vi.fn>).mock.calls.length;

    // Wrong animation name on the right element.
    scope.dispatchEvent(animationEndEvent("not-the-one"));
    // Right name but bubbled from a child.
    const child = document.createElement("div");
    scope.appendChild(child);
    child.dispatchEvent(
      animationEndEvent(animationName("screen", "branches-css", "PUSHING-true"), true)
    );

    expect(d.getTransitionTaskId).toHaveBeenCalledTimes(baseline);
    cleanup();
  });
});

describe("createTransitionEngine gate-phase reporting", () => {
  // The gate backstop's clock starts at the park; the engine must report the
  // hold ("motion not started — don't snap") and the release ("motion starting
  // — fresh window") so a long entering-commit block delays the transition
  // instead of losing it. See TaskManger.markGateHeld / anchorGate.
  it("reports HELD before the hold releases and ANCHORS on release", async () => {
    const TaskManger = (await import("@core/TaskManger")).default;
    const held = vi.spyOn(TaskManger, "markGateHeld");
    const anchored = vi.spyOn(TaskManger, "anchorGate");
    const { scope } = elements();
    const d = { ...deps(), getTransitionTaskId: vi.fn(() => "task-gate-1") };
    const engine = createTransitionEngine(d);

    const preRelease = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: false
    });
    expect(held).toHaveBeenCalledWith("task-gate-1");
    expect(anchored).not.toHaveBeenCalled();
    preRelease();

    const postRelease = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    expect(anchored).toHaveBeenCalledWith("task-gate-1");
    postRelease();

    held.mockRestore();
    anchored.mockRestore();
  });
});

describe("reveal-shaped transitions (active no-op, passive animated)", () => {
  // The transition's whole visible motion lives on the EXIT side (the old
  // screen animates out above the standing new one). A microtask resolve
  // would flip COMPLETED instantly and cut that exit off — the task must span
  // the passive variant's motion, armed at the hold release.
  it("spans the passive exit instead of resolving on a microtask", async () => {
    vi.useFakeTimers();
    const TaskManger = (await import("@core/TaskManger")).default;
    const resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    transitionMap.set(
      "reveal-branch" as never,
      createTransition({
        name: "reveal-branch" as never,
        initial: { x: 0 },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0 } },
        enterBack: { value: { x: 0 }, options: { duration: 0 } },
        exit: { value: { opacity: 0 }, options: { duration: 0.15 } },
        exitBack: { value: { opacity: 0 }, options: { duration: 0.15 } }
      })
    );
    try {
      const { scope } = elements();
      const d = { ...deps(), getTransitionTaskId: vi.fn(() => "reveal-task") };
      const engine = createTransitionEngine(d);

      // Pre-release: the span must not arm yet (a heavy pre-release commit
      // delays the exit; resolving on the original clock would truncate it).
      const preRelease = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "reveal-branch" as never,
        prevTransitionName: "reveal-branch" as never,
        status: "REPLACING",
        isActive: true,
        animHoldReleased: false
      });
      await vi.advanceTimersByTimeAsync(1000);
      expect(resolveSpy).not.toHaveBeenCalled();
      preRelease();

      // Released: the task resolves after the passive motion span (+margin),
      // never on a microtask.
      const released = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "reveal-branch" as never,
        prevTransitionName: "reveal-branch" as never,
        status: "REPLACING",
        isActive: true,
        animHoldReleased: true
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(resolveSpy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(150);
      expect(resolveSpy).toHaveBeenCalledWith("reveal-task");
      released();

      // Cleanup cancels a pending span (interrupt safety).
      const interrupted = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "reveal-branch" as never,
        prevTransitionName: "reveal-branch" as never,
        status: "REPLACING",
        isActive: true,
        animHoldReleased: true
      });
      interrupted();
      resolveSpy.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(resolveSpy).not.toHaveBeenCalled();
    } finally {
      resolveSpy.mockRestore();
      transitionMap.delete("reveal-branch" as never);
      vi.useRealTimers();
    }
  });
});
