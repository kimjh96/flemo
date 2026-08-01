import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import { animationName } from "@transition/compileTransitionStyles";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import { resolveVariantMotion } from "@transition/variantMotion";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { perceptualCutMs } from "@core/engine/perceptualSpan";
import transitionPlayers from "@core/engine/transitionPlayer";
import { SKIP_ANIMATION_ATTR } from "@core/engine/types";
import createPartTransition from "@transition/partTransition/createPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// jsdom reads as non-Blink (no navigator.userAgentData), where the player
// defaults OFF; these suites exercise the player paths, so pin it on via
// the diagnostic force key.
beforeAll(() => sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`));
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

describe("kind-scoped driver routing", () => {
  const drive = (scope: HTMLElement, transitionName: string) => {
    const d = deps();
    d.getTransitionTaskId.mockReturnValue("route-task" as never);
    const engine = createTransitionEngine(d);
    return engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: transitionName as never,
      prevTransitionName: transitionName as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
  };

  it("a fast slide refuses the player and stays on the native clock", () => {
    // jsdom default is non-Blink → the player would drive; a measurable box
    // makes cupertino classify as native, so the join must be refused.
    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
    sessionStorage.removeItem("flemo:motion-driver-force");
    const { scope } = elements();
    Object.defineProperty(scope, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
    document.body.appendChild(scope);
    const join = vi.spyOn(transitionPlayers, "join");
    const cleanup = drive(scope, "cupertino");
    expect(join).not.toHaveBeenCalled();
    cleanup();
    join.mockRestore();
    scope.remove();
  });

  it("a 'raf' force pin bypasses the classification (diagnostic sessions player-drive everything)", () => {
    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
    try {
      const { scope } = elements();
      Object.defineProperty(scope, "clientWidth", { value: 400, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
      document.body.appendChild(scope);
      const join = vi.spyOn(transitionPlayers, "join");
      const cleanup = drive(scope, "cupertino");
      expect(join).toHaveBeenCalled();
      cleanup();
      join.mockRestore();
      scope.remove();
    } finally {
      sessionStorage.removeItem("flemo:motion-driver-force");
    }
  });
});

describe("native-clock stall watch wiring", () => {
  it("a stall during a native-driven flight re-anchors the scope's animations and re-arms the deadlines", () => {
    // Controllable rAF clock so the stall watcher sees an explicit gap.
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.set(++frameId, cb);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames.delete(handle);
    });
    const pump = (time: number) => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(time));
    };
    try {
      const { scope } = elements();
      // A measurable box classifies cupertino as native → joinPlayer refuses →
      // recovering wiring (jsdom reads as non-Blink) arms the stall watch.
      Object.defineProperty(scope, "clientWidth", { value: 400, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
      document.body.appendChild(scope);
      const anim = {
        animationName: "flemo-screen-cupertino-PUSHING-true",
        playState: "running",
        startTime: 100
      };
      // The watcher sweeps the documentElement subtree (a stall is a
      // page-global event).
      (document.documentElement as unknown as { getAnimations: () => unknown[] }).getAnimations =
        () => [anim];
      const d = deps();
      d.getTransitionTaskId.mockReturnValue("stall-task" as never);
      const engine = createTransitionEngine(d);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      pump(0);
      pump(200); // a 200ms main-thread stall
      // The watcher shifted the running flemo animation's timeline forward by
      // the excess over two nominal frames.
      expect(anim.startTime).toBeGreaterThan(100 + 160);
      cleanup();

      // Without a task (nothing to gate) the deadline nudges are a no-op but
      // the timeline shift itself still runs — and a binding that reports no
      // bars at all is equivalent to an empty set.
      frames.clear();
      anim.startTime = 100;
      const bare = deps();
      const bareEngine = createTransitionEngine(bare);
      const bareCleanup = bareEngine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: undefined }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      // Fresh, LATER frame timestamps: rAF time is monotonic per page, and
      // the shift dedup keys on it.
      pump(300);
      pump(500);
      expect(anim.startTime).toBeGreaterThan(100 + 160);
      bareCleanup();
      scope.remove();
    } finally {
      delete (document.documentElement as unknown as { getAnimations?: unknown }).getAnimations;
      vi.unstubAllGlobals();
    }
  });
});

describe("native-clock stall watch is Blink-gated", () => {
  it("does not arm on Blink (the compositor plays through main stalls)", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.set(++frameId, cb);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames.delete(handle);
    });
    const pump = (time: number) => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(time));
    };
    Object.defineProperty(navigator, "userAgentData", { value: {}, configurable: true });
    try {
      const { scope } = elements();
      Object.defineProperty(scope, "clientWidth", { value: 400, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
      document.body.appendChild(scope);
      const anim = {
        animationName: "flemo-screen-cupertino-PUSHING-true",
        playState: "running",
        startTime: 100
      };
      // The watcher sweeps the documentElement subtree (a stall is a
      // page-global event).
      (document.documentElement as unknown as { getAnimations: () => unknown[] }).getAnimations =
        () => [anim];
      const d = deps();
      d.getTransitionTaskId.mockReturnValue("blink-task" as never);
      const engine = createTransitionEngine(d);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      pump(0);
      pump(200);
      // No watcher armed: the animation timeline is untouched.
      expect(anim.startTime).toBe(100);
      cleanup();
      scope.remove();
    } finally {
      delete (navigator as { userAgentData?: unknown }).userAgentData;
      vi.unstubAllGlobals();
    }
  });
});

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
    // Anchored with the authored span + recovery margin (0.7s cupertino).
    expect(anchored).toHaveBeenCalledWith("task-gate-1", 700 + 1500);
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

describe("perceptual completion cut", () => {
  it("resolves the task once remaining motion is sub-pixel, before animationend", async () => {
    vi.useFakeTimers();
    // The cut is compiled-CSS-path only; this file pins the raf player in
    // beforeAll, so pin css for this test.
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    try {
      const { scope } = elements();
      // jsdom boxes measure 0: give the scope a real width so percentage
      // distances resolve.
      Object.defineProperty(scope, "clientWidth", { value: 390, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 720, configurable: true });
      document.body.appendChild(scope);
      const resolveSpy = vi
        .spyOn(TaskManger, "resolveTask")
        .mockImplementation(() => Promise.resolve(true));
      const d = deps();
      d.getTransitionTaskId.mockReturnValue("cut-task" as never);
      const engine = createTransitionEngine(d);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      // Well inside the visible motion: no cut yet.
      vi.advanceTimersByTime(420);
      expect(resolveSpy).not.toHaveBeenCalled();

      // Past the sub-pixel point (cut ~593ms) plus the presented-frame
      // landing deferral, but before the 700ms animationend (which jsdom
      // never fires): the cut resolves the task.
      vi.advanceTimersByTime(300);
      expect(resolveSpy).toHaveBeenCalledWith("cut-task");

      cleanup();
      resolveSpy.mockRestore();
      scope.remove();
    } finally {
      sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
      vi.useRealTimers();
    }
  });
});

describe("native stall re-anchor coverage", () => {
  it("shifts the SIBLING screen's animations with the active side", () => {
    // The covered parallax screen runs its own animation but arms no watcher
    // of its own: the active engine's watcher must re-anchor it too, or a
    // main-thread stall resumes the active side smoothly while the sibling
    // teleports the stalled span (the measured WebKit parallax snap).
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.set(++frameId, frameCallback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames.delete(handle);
    });
    const pump = (time: number) => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((frameCallback) => frameCallback(time));
    };
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      // The covered screen lives in its OWN wrapper, not beside the scope:
      // the watcher targets the documentElement subtree, which reaches it
      // regardless of structure.
      const siblingAnimation = {
        animationName: "flemo-screen-cupertino-PUSHING-false",
        playState: "running",
        startTime: 0
      };
      (document.documentElement as unknown as { getAnimations?: () => unknown[] }).getAnimations =
        () => [siblingAnimation];

      const d = deps();
      d.getTransitionTaskId.mockReturnValue("stall-task" as never);
      const engine = createTransitionEngine(d);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      pump(0);
      pump(200); // a 200ms stall
      expect(siblingAnimation.startTime).toBeGreaterThan(0);

      cleanup();
      scope.remove();
    } finally {
      delete (document.documentElement as unknown as { getAnimations?: unknown }).getAnimations;
      sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
      vi.unstubAllGlobals();
    }
  });
});

describe("driver join without a task", () => {
  it("falls back to the compiled path when no navigation task exists", () => {
    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const engine = createTransitionEngine(deps()); // getTransitionTaskId -> null
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      // No player joined (no task): the compiled animation stays untouched.
      expect(scope.style.animation).toBe("");
      cleanup();
      scope.remove();
    } finally {
      sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
    }
  });
});

describe("perceptual cut with participating parts", () => {
  const drive = (engine: ReturnType<typeof createTransitionEngine>, scope: HTMLElement) =>
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

  const cutScope = () => {
    const { scope } = elements();
    Object.defineProperty(scope, "clientWidth", { value: 390, configurable: true });
    Object.defineProperty(scope, "clientHeight", { value: 720, configurable: true });
    document.body.appendChild(scope);
    return scope;
  };

  const mountPart = (scope: HTMLElement, name: string) => {
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", name);
    part.setAttribute("data-flemo-status", "PUSHING");
    // createPartTransition maps the animated `enter` state to the -false side
    // (the screen shifting into the background).
    part.setAttribute("data-flemo-active", "false");
    scope.appendChild(part);
    return part;
  };

  it("raises the cut ceiling to a longer analyzable part motion", () => {
    vi.useFakeTimers();
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    partTransitionMap.set(
      "slow-fade" as never,
      createPartTransition({
        name: "slow-fade" as never,
        initial: { opacity: 1 },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 0 }, options: { duration: 0.8, ease: [0.32, 0.72, 0, 1] } },
        exit: { value: { opacity: 1 }, options: { duration: 0.8, ease: [0.32, 0.72, 0, 1] } }
      })
    );
    try {
      const scope = cutScope();
      mountPart(scope, "slow-fade");
      // An unregistered part contributes nothing and must not veto.
      mountPart(scope, "unregistered-part");
      const resolveSpy = vi
        .spyOn(TaskManger, "resolveTask")
        .mockImplementation(() => Promise.resolve(true));
      const d = deps();
      d.getTransitionTaskId.mockReturnValue("part-cut" as never);
      const engine = createTransitionEngine(d);
      const cleanup = drive(engine, scope);

      // Past the screen's own cut point (~593ms) AND its landing deferral
      // (~674ms) but inside the part's 0.8s fade: the ceiling must have
      // moved past the screen's cut.
      vi.advanceTimersByTime(690);
      expect(resolveSpy).not.toHaveBeenCalled();

      // Past the part's own sub-perceptual point (~652ms) plus the landing
      // deferral, still before the choreography's natural end.
      vi.advanceTimersByTime(70);
      expect(resolveSpy).toHaveBeenCalledWith("part-cut");

      cleanup();
      resolveSpy.mockRestore();
      scope.remove();
    } finally {
      partTransitionMap.delete("slow-fade" as never);
      sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
      vi.useRealTimers();
    }
  });

  it("vetoes the cut on an unanalyzable part motion", () => {
    vi.useFakeTimers();
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    partTransitionMap.set(
      "scaling-part" as never,
      createPartTransition({
        name: "scaling-part" as never,
        initial: { scale: 0.8 },
        idle: { value: { scale: 1 }, options: { duration: 0 } },
        enter: { value: { scale: 1 }, options: { duration: 0.3 } },
        exit: { value: { scale: 0.8 }, options: { duration: 0.3 } }
      })
    );
    try {
      const scope = cutScope();
      mountPart(scope, "scaling-part");
      const resolveSpy = vi
        .spyOn(TaskManger, "resolveTask")
        .mockImplementation(() => Promise.resolve(true));
      const d = deps();
      d.getTransitionTaskId.mockReturnValue("part-veto" as never);
      const engine = createTransitionEngine(d);
      const cleanup = drive(engine, scope);

      // No cut fires inside the motion span (jsdom fires no animationend;
      // the 850ms watchdog and 2100ms floor are the only other resolvers).
      vi.advanceTimersByTime(800);
      expect(resolveSpy).not.toHaveBeenCalled();

      cleanup();
      resolveSpy.mockRestore();
      scope.remove();
    } finally {
      partTransitionMap.delete("scaling-part" as never);
      sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
      vi.useRealTimers();
    }
  });
});

describe("choreography-span deferral", () => {
  it("a part authored far longer than its screen is never cut by a fixed cap", () => {
    vi.useFakeTimers();
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    // 0.35s screen with a 3s part: extra = 2650ms — beyond the old 1000ms cap.
    transitionMap.set(
      "short-screen-long-part" as never,
      createTransition({
        name: "short-screen-long-part" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.35 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.35 } },
        exit: { value: { x: "-35%" }, options: { duration: 0.35 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.35 } }
      })
    );
    partTransitionMap.set(
      "marathon-part" as never,
      createPartTransition({
        name: "marathon-part" as never,
        initial: { scale: 1 },
        idle: { value: { scale: 1 }, options: { duration: 0 } },
        enter: { value: { scale: 0.8 }, options: { duration: 3 } },
        exit: { value: { scale: 1 }, options: { duration: 3 } }
      })
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const part = document.createElement("div");
      part.setAttribute("data-flemo-part-name", "marathon-part");
      part.setAttribute("data-flemo-status", "PUSHING");
      part.setAttribute("data-flemo-active", "false");
      scope.appendChild(part);
      const resolveSpy = vi
        .spyOn(TaskManger, "resolveTask")
        .mockImplementation(() => Promise.resolve(true));
      const anchorSpy = vi.spyOn(TaskManger, "anchorGate");
      const d = deps();
      d.getTransitionTaskId.mockReturnValue("marathon-task" as never);
      const engine = createTransitionEngine(d);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "short-screen-long-part" as never,
        prevTransitionName: "short-screen-long-part" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      // The gate is anchored for the WHOLE choreography (3s part + margin),
      // so the backstop can never cut the marathon part.
      expect(anchorSpy).toHaveBeenCalledWith("marathon-task", 3000 + 1500);

      scope.dispatchEvent(
        animationEndEvent(animationName("screen", "short-screen-long-part", "PUSHING-true"))
      );
      // Deep into the part's motion, far past the old 1000ms cap: still flying.
      vi.advanceTimersByTime(2400);
      expect(resolveSpy).not.toHaveBeenCalled();

      // The full 2650ms extra elapses (+ the presented-frame deferral).
      vi.advanceTimersByTime(300);
      vi.advanceTimersByTime(132);
      expect(resolveSpy).toHaveBeenCalledWith("marathon-task");

      cleanup();
      resolveSpy.mockRestore();
      anchorSpy.mockRestore();
      scope.remove();
    } finally {
      transitionMap.delete("short-screen-long-part" as never);
      partTransitionMap.delete("marathon-part" as never);
      sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
      vi.useRealTimers();
    }
  });

  it("defers the clean-end resolve until the longest part finishes", () => {
    vi.useFakeTimers();
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    // A material-shaped screen (0.35s) with a 0.6s part: the part outlives
    // the screen by 250ms, and the COMPLETED flip must wait for it.
    transitionMap.set(
      "short-screen" as never,
      createTransition({
        name: "short-screen" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.35 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.35 } },
        exit: { value: { x: "-35%" }, options: { duration: 0.35 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.35 } }
      })
    );
    partTransitionMap.set(
      "long-part" as never,
      createPartTransition({
        name: "long-part" as never,
        initial: { scale: 1 },
        idle: { value: { scale: 1 }, options: { duration: 0 } },
        enter: { value: { scale: 0.8 }, options: { duration: 0.6 } },
        exit: { value: { scale: 1 }, options: { duration: 0.6 } }
      })
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const part = document.createElement("div");
      part.setAttribute("data-flemo-part-name", "long-part");
      part.setAttribute("data-flemo-status", "PUSHING");
      part.setAttribute("data-flemo-active", "false");
      scope.appendChild(part);
      const resolveSpy = vi
        .spyOn(TaskManger, "resolveTask")
        .mockImplementation(() => Promise.resolve(true));
      const d = deps();
      d.getTransitionTaskId.mockReturnValue("defer-task" as never);
      const engine = createTransitionEngine(d);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "short-screen" as never,
        prevTransitionName: "short-screen" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      // Clean end of the SCREEN's animation at its natural 350ms.
      scope.dispatchEvent(
        animationEndEvent(animationName("screen", "short-screen", "PUSHING-true"))
      );
      // The task must NOT resolve yet: the 0.6s part is still mid-motion.
      expect(resolveSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);
      expect(resolveSpy).not.toHaveBeenCalled();

      // ...and resolves once the part's span has elapsed (extra = 250ms)
      // plus the presented-frame deferral.
      vi.advanceTimersByTime(120);
      vi.advanceTimersByTime(132);
      expect(resolveSpy).toHaveBeenCalledWith("defer-task");

      cleanup();
      resolveSpy.mockRestore();
      scope.remove();
    } finally {
      transitionMap.delete("short-screen" as never);
      partTransitionMap.delete("long-part" as never);
      sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
      vi.useRealTimers();
    }
  });
});

describe("in-flight arrival hold wiring", () => {
  const observerFlush = () => new Promise((resolve) => setTimeout(resolve, 0));
  // The landing is deferred two frames past COMPLETED (off the convergence
  // commit); tests flush both rAFs plus a macrotask.
  const landingFlush = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)))
    );

  it("holds a mid-flight swap on the entering screen and reflects it at COMPLETED", async () => {
    const { scope } = elements();
    document.body.appendChild(scope);
    const skeleton = document.createElement("div");
    scope.appendChild(skeleton);
    const engine = createTransitionEngine(deps());

    // Pre-release run: the screen is parked under a cover, landings are
    // invisible — no hold yet.
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: false
    });
    const early = document.createElement("aside");
    scope.appendChild(early);
    await observerFlush();
    expect(early.hasAttribute("data-flemo-held-arrival")).toBe(false);

    // Post-release run arms the hold; a Suspense-style swap parks.
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    const content = document.createElement("article");
    scope.replaceChild(content, skeleton);
    await observerFlush();
    expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);
    expect(skeleton.parentNode).toBe(scope);

    // COMPLETED lands the swap two frames later, off the convergence commit.
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "COMPLETED",
      isActive: true,
      animHoldReleased: true
    });
    expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);
    await landingFlush();
    expect(skeleton.parentNode).toBe(null);
    expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);
    scope.remove();
  });

  it("holds on the pop destination (passive cold side) and releases on its COMPLETED", async () => {
    const { scope } = elements();
    document.body.appendChild(scope);
    const engine = createTransitionEngine(deps());

    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "POPPING",
      isActive: false,
      animHoldReleased: true
    });
    const refreshed = document.createElement("article");
    scope.appendChild(refreshed);
    await observerFlush();
    expect(refreshed.hasAttribute("data-flemo-held-arrival")).toBe(true);

    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "COMPLETED",
      isActive: false,
      animHoldReleased: true
    });
    await landingFlush();
    expect(refreshed.hasAttribute("data-flemo-held-arrival")).toBe(false);
    scope.remove();
  });

  it("lands a pending deferred landing before a new transition's first frame", async () => {
    const { scope } = elements();
    document.body.appendChild(scope);
    const skeleton = document.createElement("div");
    scope.appendChild(skeleton);
    const engine = createTransitionEngine(deps());
    const drive = (status: "PUSHING" | "COMPLETED", isActive: boolean) =>
      engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status,
        isActive,
        animHoldReleased: true
      });

    drive("PUSHING", true);
    const content = document.createElement("article");
    scope.replaceChild(content, skeleton);
    await observerFlush();
    expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

    // COMPLETED schedules the landing; a new navigation starts immediately,
    // BEFORE the two-frame window elapses.
    drive("COMPLETED", true);
    drive("PUSHING", true);
    // The pending landing must have been applied synchronously at re-arm.
    expect(skeleton.parentNode).toBe(null);
    expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);
    scope.remove();
  });

  it("never holds on the warm exiting side", async () => {
    const { scope } = elements();
    document.body.appendChild(scope);
    const engine = createTransitionEngine(deps());

    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true
    });
    const live = document.createElement("article");
    scope.appendChild(live);
    await observerFlush();
    expect(live.hasAttribute("data-flemo-held-arrival")).toBe(false);
    scope.remove();
  });

  it("holds the cold screen's invisible animations and resumes them with the hold's release", async () => {
    const { scope } = elements();
    document.body.appendChild(scope);
    const invisibleSection = document.createElement("section");
    invisibleSection.style.opacity = "0";
    scope.appendChild(invisibleSection);
    const shimmer = {
      animationName: "skeleton-wave",
      playState: "running" as AnimationPlayState,
      effect: { target: invisibleSection },
      pause() {
        this.playState = "paused";
      },
      play() {
        this.playState = "running";
      }
    };
    (scope as { getAnimations?: () => unknown[] }).getAnimations = () => [shimmer];
    const engine = createTransitionEngine(deps());
    const drive = (status: string) =>
      engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: status as never,
        isActive: true,
        animHoldReleased: true
      });
    drive("PUSHING")();
    // The watcher's first scan waits a frame for the arming commit's styles.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    expect(shimmer.playState).toBe("paused");

    // The interrupt path consumes the hold — the invisible animations resume
    // in the same breath.
    drive("POPPING")();
    expect(shimmer.playState).toBe("running");
    scope.remove();
  });
});

describe("arrival-hold early landing (sub-pixel tail)", () => {
  // Pixel endpoints make the rest point computable on jsdom's zero-size
  // boxes (percentages resolve to 0 there, which reads as "no translation"
  // and falls back to the post-COMPLETED landing — the path the suite above
  // covers). The strongly-decelerating ease gives the band scan a real tail.
  const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
  const slideTargets = (duration: number) => ({
    idle: { value: { x: 0 }, options: { duration: 0 } },
    enter: { value: { x: 0 }, options: { duration, ease: EASE } },
    enterBack: { value: { x: "320px" }, options: { duration, ease: EASE } },
    exit: { value: { x: "-112px" }, options: { duration, ease: EASE } },
    exitBack: { value: { x: 0 }, options: { duration, ease: EASE } }
  });

  const driveWith = (engine: ReturnType<typeof createTransitionEngine>, scope: HTMLElement) =>
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "px-slide" as never,
      prevTransitionName: "px-slide" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

  it("lands the held arrival at the CSS-pixel rest point, before COMPLETED", async () => {
    vi.useFakeTimers();
    transitionMap.set(
      "px-slide" as never,
      createTransition({
        name: "px-slide" as never,
        initial: { x: "320px" },
        ...slideTargets(0.6)
      } as never)
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const skeleton = document.createElement("div");
      scope.appendChild(skeleton);
      const engine = createTransitionEngine(deps());
      const cleanup = driveWith(engine, scope);

      const content = document.createElement("article");
      scope.replaceChild(content, skeleton);
      await vi.advanceTimersByTimeAsync(0);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      const motion = resolveVariantMotion(transitionMap.get("px-slide" as never)!, "PUSHING-true")!;
      const restMs = perceptualCutMs(motion, { clientWidth: 0, clientHeight: 0 }, 1)!;
      expect(restMs).toBeGreaterThan(0);
      expect(restMs).toBeLessThan(600);

      // Just short of the rest point: still visibly mid-motion, still held.
      await vi.advanceTimersByTimeAsync(restMs - 20);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);
      // At the rest point — while the status is still PUSHING — the swap
      // reflects: skeleton out, content on glass.
      await vi.advanceTimersByTimeAsync(30);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);
      expect(skeleton.parentNode).toBe(null);

      cleanup();
      scope.remove();
    } finally {
      transitionMap.delete("px-slide" as never);
      vi.useRealTimers();
    }
  });

  it("a part still moving at the screen's rest point extends the landing", async () => {
    vi.useFakeTimers();
    transitionMap.set(
      "px-slide" as never,
      createTransition({
        name: "px-slide" as never,
        initial: { x: "320px" },
        ...slideTargets(0.6)
      } as never)
    );
    partTransitionMap.set(
      "long-slide-part" as never,
      createPartTransition({
        name: "long-slide-part" as never,
        initial: { x: "100px" },
        // A part's PUSHING-false motion resolves idle → enter.
        idle: { value: { x: "100px" }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 1.2, ease: EASE } },
        exit: { value: { x: "-100px" }, options: { duration: 1.2, ease: EASE } }
      } as never)
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const part = document.createElement("div");
      part.setAttribute("data-flemo-part-name", "long-slide-part");
      part.setAttribute("data-flemo-status", "PUSHING");
      part.setAttribute("data-flemo-active", "false");
      scope.appendChild(part);
      const engine = createTransitionEngine(deps());
      const cleanup = driveWith(engine, scope);

      const content = document.createElement("article");
      scope.appendChild(content);
      await vi.advanceTimersByTimeAsync(0);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      const partMotion = resolveVariantMotion(
        partTransitionMap.get("long-slide-part" as never)!,
        "PUSHING-false"
      )!;
      const partRestMs = perceptualCutMs(partMotion, { clientWidth: 0, clientHeight: 0 }, 1)!;
      expect(partRestMs).toBeGreaterThan(600);

      // Past the screen's own rest, the part is still visibly moving: held.
      await vi.advanceTimersByTimeAsync(620);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);
      // Once EVERY participant is inside its band, the landing fires.
      await vi.advanceTimersByTimeAsync(partRestMs - 620 + 10);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);

      cleanup();
      scope.remove();
    } finally {
      transitionMap.delete("px-slide" as never);
      partTransitionMap.delete("long-slide-part" as never);
      vi.useRealTimers();
    }
  });

  it("a choreography whose passive side stands still rests on the active motion alone", async () => {
    vi.useFakeTimers();
    transitionMap.set(
      "px-slide" as never,
      createTransition({
        name: "px-slide" as never,
        initial: { x: "320px" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.6, ease: EASE } },
        enterBack: { value: { x: "320px" }, options: { duration: 0.6, ease: EASE } },
        // The passive side rests: a zero-duration exit registers no motion at
        // all, so only the active side constrains the rest point.
        exit: { value: { x: 0 }, options: { duration: 0 } },
        exitBack: { value: { x: 0 }, options: { duration: 0 } }
      } as never)
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const engine = createTransitionEngine(deps());
      const cleanup = driveWith(engine, scope);

      const content = document.createElement("article");
      scope.appendChild(content);
      await vi.advanceTimersByTimeAsync(0);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      const motion = resolveVariantMotion(transitionMap.get("px-slide" as never)!, "PUSHING-true")!;
      const restMs = perceptualCutMs(motion, { clientWidth: 0, clientHeight: 0 }, 1)!;
      await vi.advanceTimersByTimeAsync(restMs + 10);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);

      cleanup();
      scope.remove();
    } finally {
      transitionMap.delete("px-slide" as never);
      vi.useRealTimers();
    }
  });

  it("an armed landing whose hold an interrupt already consumed fires as a no-op", async () => {
    vi.useFakeTimers();
    transitionMap.set(
      "px-slide" as never,
      createTransition({
        name: "px-slide" as never,
        initial: { x: "320px" },
        ...slideTargets(0.6)
      } as never)
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const engine = createTransitionEngine(deps());
      // The flight's run stays mounted (no cleanup) so its wall-clock landing
      // stays armed while the interrupt consumes the hold underneath it.
      driveWith(engine, scope);

      const content = document.createElement("article");
      scope.appendChild(content);
      await vi.advanceTimersByTimeAsync(0);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      // Role flip mid-flight: the interrupt path lands everything NOW.
      const cleanupInterrupt = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "px-slide" as never,
        prevTransitionName: "px-slide" as never,
        status: "POPPING",
        isActive: true,
        animHoldReleased: true
      });
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);

      // The stale timer fires against the spent hold and must change nothing.
      await vi.advanceTimersByTimeAsync(600);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);
      expect(content.parentNode).toBe(scope);

      cleanupInterrupt();
      scope.remove();
    } finally {
      transitionMap.delete("px-slide" as never);
      vi.useRealTimers();
    }
  });

  it("an unanalyzable part vetoes the early landing and keeps the COMPLETED path", async () => {
    vi.useFakeTimers();
    transitionMap.set(
      "px-slide" as never,
      createTransition({
        name: "px-slide" as never,
        initial: { x: "320px" },
        ...slideTargets(0.6)
      } as never)
    );
    partTransitionMap.set(
      "scale-part" as never,
      createPartTransition({
        name: "scale-part" as never,
        initial: { scale: 0.8 },
        // idle → enter carries a real scale motion: present, animating, and
        // outside the band scan's known channels.
        idle: { value: { scale: 0.8 }, options: { duration: 0 } },
        enter: { value: { scale: 1 }, options: { duration: 0.4 } },
        exit: { value: { scale: 1 }, options: { duration: 0.4 } }
      } as never)
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const part = document.createElement("div");
      part.setAttribute("data-flemo-part-name", "scale-part");
      part.setAttribute("data-flemo-status", "PUSHING");
      part.setAttribute("data-flemo-active", "false");
      scope.appendChild(part);
      const engine = createTransitionEngine(deps());
      const cleanup = driveWith(engine, scope);

      const content = document.createElement("article");
      scope.appendChild(content);
      await vi.advanceTimersByTimeAsync(0);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      // A scale channel cannot be band-scanned: no wall-clock landing may
      // fire, however long the flight runs.
      await vi.advanceTimersByTimeAsync(5000);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      cleanup();
      scope.remove();
    } finally {
      transitionMap.delete("px-slide" as never);
      partTransitionMap.delete("scale-part" as never);
      vi.useRealTimers();
    }
  });
});

describe("compositor warm-up settle extension", () => {
  it("keeps the warm element alive 400ms past COMPLETED, then removes it", () => {
    vi.useFakeTimers();
    const originalAnimate = Element.prototype.animate;
    const cancel = vi.fn();
    Element.prototype.animate = vi.fn(
      () => ({ cancel }) as unknown as Animation
    ) as unknown as typeof Element.prototype.animate;
    try {
      const { scope } = elements();
      const engine = createTransitionEngine(deps());
      const drive = (status: string) =>
        engine.driveScreenLifecycle({
          getElements: () => ({ scope, decorator: null, bars: [] }),
          transitionName: "cupertino" as never,
          prevTransitionName: "cupertino" as never,
          status: status as never,
          isActive: true,
          animHoldReleased: true
        });

      const cleanupFlight = drive("PUSHING");
      expect(document.querySelector("[data-flemo-warm]")).not.toBeNull();
      cleanupFlight();

      // COMPLETED: the warm-up must survive the settle window...
      const cleanupRest = drive("COMPLETED");
      expect(document.querySelector("[data-flemo-warm]")).not.toBeNull();
      vi.advanceTimersByTime(399);
      expect(document.querySelector("[data-flemo-warm]")).not.toBeNull();
      // ...and end right after it.
      vi.advanceTimersByTime(2);
      expect(document.querySelector("[data-flemo-warm]")).toBeNull();
      cleanupRest();
    } finally {
      Element.prototype.animate = originalAnimate;
      vi.useRealTimers();
    }
  });

  it("a new flight inside the settle window keeps the warm-up unbroken", () => {
    vi.useFakeTimers();
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = vi.fn(
      () => ({ cancel: vi.fn() }) as unknown as Animation
    ) as unknown as typeof Element.prototype.animate;
    try {
      const { scope } = elements();
      const engine = createTransitionEngine(deps());
      const drive = (status: string) =>
        engine.driveScreenLifecycle({
          getElements: () => ({ scope, decorator: null, bars: [] }),
          transitionName: "cupertino" as never,
          prevTransitionName: "cupertino" as never,
          status: status as never,
          isActive: true,
          animHoldReleased: true
        });

      drive("PUSHING")();
      drive("COMPLETED")();
      vi.advanceTimersByTime(200);
      // Next navigation starts mid-settle: the pending release is cancelled.
      drive("POPPING")();
      vi.advanceTimersByTime(1000);
      expect(document.querySelector("[data-flemo-warm]")).not.toBeNull();
      // Its own COMPLETED starts a fresh settle window.
      drive("COMPLETED")();
      vi.advanceTimersByTime(401);
      expect(document.querySelector("[data-flemo-warm]")).toBeNull();
    } finally {
      Element.prototype.animate = originalAnimate;
      vi.useRealTimers();
    }
  });
});

describe("arrival-hold interrupt and SSR landing paths", () => {
  it("an interrupt lands held content immediately, before the new flight's first frame", async () => {
    const { scope } = elements();
    document.body.appendChild(scope);
    const engine = createTransitionEngine(deps());
    const drive = (status: string, isActive: boolean) =>
      engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: status as never,
        isActive,
        animHoldReleased: true
      });

    drive("PUSHING", true)();
    const arriving = document.createElement("article");
    scope.appendChild(arriving);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(arriving.hasAttribute("data-flemo-held-arrival")).toBe(true);

    // The screen's role flips mid-flight (a pop interrupts the push): the
    // held content must land in the SAME commit, not two frames later.
    drive("POPPING", true)();
    expect(arriving.hasAttribute("data-flemo-held-arrival")).toBe(false);
    scope.remove();
  });

  it("lands immediately where requestAnimationFrame does not exist (SSR edge)", async () => {
    const originalRaf = globalThis.requestAnimationFrame;
    // @ts-expect-error simulating an environment without rAF
    delete globalThis.requestAnimationFrame;
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const engine = createTransitionEngine(deps());
      const drive = (status: string) =>
        engine.driveScreenLifecycle({
          getElements: () => ({ scope, decorator: null, bars: [] }),
          transitionName: "cupertino" as never,
          prevTransitionName: "cupertino" as never,
          status: status as never,
          isActive: true,
          animHoldReleased: true
        });
      drive("PUSHING")();
      const arriving = document.createElement("article");
      scope.appendChild(arriving);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(arriving.hasAttribute("data-flemo-held-arrival")).toBe(true);

      drive("COMPLETED")();
      expect(arriving.hasAttribute("data-flemo-held-arrival")).toBe(false);
      scope.remove();
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
    }
  });
});

describe("compositor warm-up without setTimeout", () => {
  it("releases the warm hold immediately where timers do not exist", () => {
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = vi.fn(
      () => ({ cancel: vi.fn() }) as unknown as Animation
    ) as unknown as typeof Element.prototype.animate;
    const { scope } = elements();
    const engine = createTransitionEngine(deps());
    const drive = (status: string) =>
      engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: status as never,
        isActive: true,
        animHoldReleased: true
      });
    drive("PUSHING")();
    expect(document.querySelector("[data-flemo-warm]")).not.toBeNull();

    const originalSetTimeout = globalThis.setTimeout;
    // @ts-expect-error simulating an environment without timers for the
    // release decision only (restored synchronously below).
    globalThis.setTimeout = undefined;
    try {
      drive("COMPLETED")();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      Element.prototype.animate = originalAnimate;
    }
    expect(document.querySelector("[data-flemo-warm]")).toBeNull();
  });
});
