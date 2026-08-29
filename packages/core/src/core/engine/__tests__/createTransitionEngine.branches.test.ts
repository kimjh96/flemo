import { describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import { animationName } from "@transition/compileTransitionStyles";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import { resolveVariantMotion } from "@transition/variantMotion";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { resetFlightWindowForTests } from "@core/engine/flightWindow";
import { LAYER_SETTLE_MS } from "@core/engine/layerSettleHold";
import { perceptualCutMs } from "@core/engine/perceptualSpan";
import { SKIP_ANIMATION_ATTR } from "@core/engine/types";
import createPartTransition from "@transition/partTransition/createPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// jsdom reads as non-Blink with no touch points, so these suites exercise the
// COMPILED path — the only motion driver the engine has.

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
      // An authored driver:'native' pin opts this flight into clock surgery,
      // so the recovery wiring (jsdom reads as non-Blink) arms the stall watch.
      transitionMap.set(
        "branches-stall-pin" as never,
        createTransition({
          name: "branches-stall-pin" as never,
          initial: { x: "100%" },
          idle: { value: { x: 0 }, options: { duration: 0 } },
          enter: { value: { x: 0 }, options: { duration: 0.7 } },
          enterBack: { value: { x: "100%" }, options: { duration: 0.7 } },
          exit: { value: { x: "-30%" }, options: { duration: 0.7 } },
          exitBack: { value: { x: 0 }, options: { duration: 0.7 } },
          options: { driver: "native" }
        })
      );
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
        transitionName: "branches-stall-pin" as never,
        prevTransitionName: "branches-stall-pin" as never,
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
        transitionName: "branches-stall-pin" as never,
        prevTransitionName: "branches-stall-pin" as never,
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
      transitionMap.delete("branches-stall-pin" as never);
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
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Chromium", version: "120" }] },
      configurable: true
    });
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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { scope, decorator, bar } = elements();
      // A riding bar the engine actually stamps during the flight (the layer
      // settle hold only manages elements it promoted — a will-change the
      // engine never wrote is a consumer's and is left untouched).
      bar.setAttribute("data-flemo-bar-riding", "true");
      const d = deps();
      const engine = createTransitionEngine(d);

      // Flight: the engine stamps the riding bar's promotion.
      engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator, bars: [bar, null] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      expect(bar.style.willChange).toBe("transform");

      // COMPLETED: strip skip markers and release the promoted layer.
      scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
      decorator.setAttribute(SKIP_ANIMATION_ATTR, "true");
      scope.style.transition = "none";
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
      // The bar's promoted layer demotes off-cadence, LAYER_SETTLE_MS past
      // the flip (see layerSettleHold.ts) — never in the flip commit itself.
      expect(bar.style.willChange).toBe("transform");
      // jsdom + fake timers never run the landing's composed flight-window
      // release (it rides the real rAF clock) — close it as the landing does.
      resetFlightWindowForTests();
      vi.advanceTimersByTime(LAYER_SETTLE_MS);
      expect(bar.style.willChange).toBe("");
      expect(d.setDragStatus).toHaveBeenCalledWith("IDLE");
      expect(d.setReplaceTransitionStatus).toHaveBeenCalledWith("IDLE");
      cleanup();
    } finally {
      vi.useRealTimers();
    }
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
    // Bars are the one participant class SHARABLE across drivers, so the
    // engine's COMPLETED releases only its OWN stakes there: the player's
    // track detach (running in the same cleanup) strips its writes under its
    // own token, and a foreign/untracked write is deliberately left to its
    // writer instead of being force-stripped out from under it.
    expect(bar.style.transform).toBe("translate3d(-490px, 0px, 0px)");
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
    // null, so the flight carries no screen motion of its own.
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

  it("an active screen with a motionless decorator variant promotes only its scope", () => {
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

    // Each participant is gated on its OWN definition's animation: the screen
    // animates and takes the inline layer pin; the idle decorator variant does
    // not, so nothing is written to it.
    expect(scope.style.willChange).not.toBe("");
    expect(decorator.style.willChange).toBe("");
    cleanup();
    scope.remove();
    decorator.remove();
    transitionMap.delete("branches-active-deco" as never);
  });

  it("this screen's <Part> elements are promoted; nested screens' parts are not", () => {
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

    // This screen's part took the inline layer pin; the nested screen's part
    // belongs to its own engine and must be untouched.
    expect(part.style.willChange).not.toBe("");
    expect(nestedPart.style.willChange).toBe("");

    cleanup();

    container.remove();
    partTransitionMap.delete("title-fade" as never);
    transitionMap.delete("branches-parts" as never);
  });

  it("parts with no registered definition or a motionless variant are not promoted", () => {
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
    const clipped = partOf("clipped-part"); // animates a non-translation channel
    container.append(scope, ghost, still, clipped);
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
      "clipped-part" as never,
      createPartTransition({
        name: "clipped-part" as never,
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

    // The screen is promoted. An unregistered part and a motionless variant
    // are skipped; a part that DOES animate (any channel) is promoted like any
    // other participant.
    expect(scope.style.willChange).not.toBe("");
    expect(ghost.style.willChange).toBe("");
    expect(still.style.willChange).toBe("");
    expect(clipped.style.willChange).not.toBe("");

    cleanup();
    container.remove();
    partTransitionMap.delete("still-part" as never);
    partTransitionMap.delete("clipped-part" as never);
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

  it("a passive transitional screen promotes its riding bars and decorator", () => {
    const { scope, decorator, bar } = elements();
    const ridingBar = document.createElement("div");
    ridingBar.setAttribute("data-flemo-bar-riding", "true");
    document.body.append(scope, decorator, bar, ridingBar);
    const d = {
      getTransitionTaskId: vi.fn(() => "player-task"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    const engine = createTransitionEngine(d);

    // A translating screen + the overlay decorator: the passive side of a push
    // pins the layer of every participant that actually animates.
    transitionMap.set(
      "branches-participants" as never,
      createTransition({
        name: "branches-participants" as never,
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
      transitionName: "branches-participants" as never,
      prevTransitionName: "branches-participants" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true
    });

    // The scope, the RIDING bar and the decorator each took the inline layer
    // pin; the non-riding bar did not (it does not run the screen's rule).
    expect(scope.style.willChange).not.toBe("");
    expect(ridingBar.style.willChange).not.toBe("");
    expect(bar.style.willChange).toBe("");
    expect(decorator.style.willChange).not.toBe("");

    cleanup();

    scope.remove();
    decorator.remove();
    bar.remove();
    ridingBar.remove();
    transitionMap.delete("branches-participants" as never);
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

  it("resolves on a head tier's suffixed animation name", async () => {
    // A head tier (LPM, desktop) plays the SAME flight under a copied keyframe
    // set, so its end event carries `<name>-gov` / `<name>-deskhead`. A
    // listener that only knows the base name never resolves the flight, and
    // the restart watchdog replays the whole transition — glass-visible on
    // desktop Safari as a second fade after a tab REPLACE (2026-08-20).
    const TaskManger = (await import("@core/TaskManger")).default;

    for (const suffix of ["", "-gov", "-deskhead"]) {
      const { scope } = elements();
      const d = { ...deps(), getTransitionTaskId: vi.fn(() => `task-head${suffix}`) };
      const engine = createTransitionEngine(d);
      const resolved = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);

      transitionMap.set(
        "branches-head" as never,
        createTransition({
          name: "branches-head" as never,
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
        transitionName: "branches-head" as never,
        prevTransitionName: "branches-head" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      scope.dispatchEvent(
        animationEndEvent(`${animationName("screen", "branches-head", "PUSHING-true")}${suffix}`)
      );
      // A clean end resolves behind the landing-clear rAF chain, so WAIT FOR
      // THE CALL rather than sleeping a span that looks long enough: a loaded
      // CI runner outran a fixed 80ms sleep, which failed here AND leaked the
      // late resolve into a later test's spy (a spy this one had already
      // restored). Polling ends the wait the moment the flight resolves, and
      // the teardown below runs whether or not it did.
      const resolvedWithin = await (async () => {
        for (let attempt = 0; attempt < 100; attempt++) {
          if (resolved.mock.calls.length > 0) return true;
          await new Promise((tick) => setTimeout(tick, 20));
        }
        return false;
      })();

      try {
        expect(resolvedWithin, `suffix "${suffix}" must resolve the flight`).toBe(true);
      } finally {
        cleanup();
        resolved.mockRestore();
        transitionMap.delete("branches-head" as never);
      }
    }
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

  it("releases a superseded governed easing when the next variant cannot be governed", async () => {
    // Diagnostic snap ON (Blink + session flag): a snappable slide stamps a
    // reshaped linear() timing-function. If it is interrupted and the SAME
    // scope enters an opacity-only transition (unsnappable), the stale
    // easing must be released — not bend the new variant's curve.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Chromium", version: "120" }] },
      configurable: true
    });
    // The landing governor stamps an inline easing on touch Blink at a
    // high-refresh cadence (see landingGovernor.ts) — that stamp is the
    // superseded stake this test is about.
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    const { reportDisplayIntervalMs } = await import("@platform/displayCadence");
    reportDisplayIntervalMs(1000 / 120);
    const { transitionMap } = await import("@transition/transition");
    const createTransition = (await import("@transition/createTransition")).default;
    transitionMap.set(
      "fade-only" as never,
      createTransition({
        name: "fade-only" as never,
        initial: { opacity: 0 },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 1 }, options: { duration: 0.3 } },
        enterBack: { value: { opacity: 1 }, options: { duration: 0.3 } },
        exit: { value: { opacity: 0 }, options: { duration: 0.3 } },
        exitBack: { value: { opacity: 0 }, options: { duration: 0.3 } }
      }) as never
    );
    const { scope } = elements();
    // Wide enough that the governor's sprint fits inside the authored span (a
    // narrow box lands so late that the reshape bails).
    Object.defineProperty(scope, "clientWidth", { value: 1400, configurable: true });
    Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
    // The consumer's own inline value — the lease's restore target.
    scope.style.animationTimingFunction = "ease-in";
    const d = deps();
    const engine = createTransitionEngine(d);
    try {
      const first = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      // The governor stamped a reshaped linear() under the engine's lease.
      // jsdom REJECTS the linear() value itself (a real browser holds it), so
      // model the stuck stamp with a valid stand-in on the SAME lease.
      scope.style.animationTimingFunction = "steps(4)";
      first(); // interrupt

      const second = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "fade-only" as never,
        prevTransitionName: "cupertino" as never,
        status: "REPLACING",
        isActive: true,
        animHoldReleased: true
      });
      // Ungovernable variant (opacity only): the superseded stake is released AT DRIVE ENTRY
      // and the lease restores the consumer's own easing — the stale stamp
      // must not bend this variant's curve.
      expect(scope.style.animationTimingFunction).toBe("ease-in");
      second();
    } finally {
      reportDisplayIntervalMs(1000 / 60); // restore the 60Hz-nominal seed
      delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
      delete (navigator as { userAgentData?: unknown }).userAgentData;
      transitionMap.delete("fade-only" as never);
    }
  });

  it("falls back to a device-pixel ratio of 1 when the environment reports none", async () => {
    // The governed easing is expressed in DEVICE pixels, so it needs a ratio.
    // An embedder that reports 0 (or nothing) must not make the reshape
    // divide by a falsy density — it takes 1 and stays correct.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Chromium", version: "120" }] },
      configurable: true
    });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { value: 0, configurable: true });
    const { reportDisplayIntervalMs } = await import("@platform/displayCadence");
    reportDisplayIntervalMs(1000 / 120);
    const { scope } = elements();
    Object.defineProperty(scope, "clientWidth", { value: 1400, configurable: true });
    Object.defineProperty(scope, "clientHeight", { value: 800, configurable: true });
    scope.style.animationTimingFunction = "ease-in";
    document.body.appendChild(scope);
    const engine = createTransitionEngine(deps());
    try {
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      // The reshape landed: a falsy ratio did not abort it, and the curve is
      // the one a ratio of 1 produces.
      expect(scope.style.animationTimingFunction).toMatch(/^linear\(/);
      cleanup();
    } finally {
      reportDisplayIntervalMs(1000 / 60);
      Object.defineProperty(window, "devicePixelRatio", {
        value: originalDpr,
        configurable: true
      });
      delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
      delete (navigator as { userAgentData?: unknown }).userAgentData;
      scope.remove();
    }
  });

  it("spans the OPPOSITE screen's part across per-screen wrappers (the real React shape)", async () => {
    // Each screen sits in its own wrapper div — the two screens of ONE
    // flight share no parentElement. The boundary is the explicit
    // data-flemo-router marker, not DOM structure.
    const TaskManger = (await import("@core/TaskManger")).default;
    const anchored = vi.spyOn(TaskManger, "anchorGate");
    const { partTransitionMap } = await import("@transition/partTransition/partTransition");
    const createPartTransition = (await import("@transition/partTransition/createPartTransition"))
      .default;
    partTransitionMap.set(
      "long-part" as never,
      createPartTransition({
        name: "long-part" as never,
        initial: { opacity: 0 },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 0.2 }, options: { duration: 3 } },
        exit: { value: { opacity: 1 }, options: { duration: 3 } }
      })
    );
    const stack = document.createElement("div");
    const wrapperA = document.createElement("div");
    const screenA = document.createElement("div");
    screenA.setAttribute("data-flemo-screen", "");
    screenA.setAttribute("data-flemo-router", "r1");
    wrapperA.appendChild(screenA);
    const wrapperB = document.createElement("div");
    const screenB = document.createElement("div");
    screenB.setAttribute("data-flemo-screen", "");
    screenB.setAttribute("data-flemo-router", "r1");
    const partB = document.createElement("div");
    partB.setAttribute("data-flemo-part-name", "long-part");
    partB.setAttribute("data-flemo-status", "PUSHING");
    partB.setAttribute("data-flemo-active", "false");
    screenB.appendChild(partB);
    wrapperB.appendChild(screenB);
    stack.append(wrapperA, wrapperB);
    document.body.appendChild(stack);
    // An UNRELATED Router's 3s bar-mounted part (its own marker): must NOT
    // inflate this flight's span.
    const foreignBar = document.createElement("div");
    foreignBar.setAttribute("data-flemo-bar", "app");
    foreignBar.setAttribute("data-flemo-router", "r2");
    const foreignPart = document.createElement("div");
    foreignPart.setAttribute("data-flemo-part-name", "long-part");
    foreignPart.setAttribute("data-flemo-status", "PUSHING");
    foreignPart.setAttribute("data-flemo-active", "true");
    foreignBar.appendChild(foreignPart);
    document.body.appendChild(foreignBar);
    // A PERSISTENT part outside any screen/bar (a header next to a <Slot>),
    // SELF-marked by the binding with another Router's identity: closest()
    // starts at the element itself, so its own marker excludes it too.
    const persistentForeign = document.createElement("div");
    persistentForeign.setAttribute("data-flemo-part-name", "long-part");
    persistentForeign.setAttribute("data-flemo-status", "PUSHING");
    persistentForeign.setAttribute("data-flemo-active", "true");
    persistentForeign.setAttribute("data-flemo-router", "r3");
    document.body.appendChild(persistentForeign);
    try {
      const d = { ...deps(), getTransitionTaskId: vi.fn(() => "task-wrap" as never) };
      const cleanup = createTransitionEngine(d).driveScreenLifecycle({
        getElements: () => ({ scope: screenA, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      // The opposite screen's 3s part rides the span (same marker);
      // the foreign Router's 3s part does not (different marker).
      expect(anchored).toHaveBeenCalledWith("task-wrap", 3000 + 1500);
      cleanup();
    } finally {
      stack.remove();
      foreignBar.remove();
      persistentForeign.remove();
      partTransitionMap.delete("long-part" as never);
      anchored.mockRestore();
    }
  });

  it("anchors the gate across a longer-authored DECORATOR (a full participant)", async () => {
    // A 3s custom dim over a 0.7s screen: every flight deadline must span
    // the decorator too — it joins the shared player like any participant,
    // and a screen-only span would cut it at ~23%.
    const TaskManger = (await import("@core/TaskManger")).default;
    const anchored = vi.spyOn(TaskManger, "anchorGate");
    const { transitionMap } = await import("@transition/transition");
    const { decoratorMap } = await import("@transition/decorator/decorator");
    const createDecorator = (await import("@transition/decorator/createDecorator")).default;
    const longDim = createDecorator({
      name: "long-dim" as never,
      initial: { opacity: 0 },
      idle: { value: { opacity: 0 }, options: { duration: 0 } },
      enter: { value: { opacity: 0.5 }, options: { duration: 3 } },
      exit: { value: { opacity: 0 }, options: { duration: 3 } }
    });
    decoratorMap.set("long-dim" as never, longDim);
    const base = transitionMap.get("cupertino")!;
    transitionMap.set("deco-span" as never, { ...base, decoratorName: "long-dim" } as never);
    try {
      const { scope } = elements();
      const d = { ...deps(), getTransitionTaskId: vi.fn(() => "task-deco" as never) };
      const cleanup = createTransitionEngine(d).driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "deco-span" as never,
        prevTransitionName: "deco-span" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });
      expect(anchored).toHaveBeenCalledWith("task-deco", 3000 + 1500);
      cleanup();
    } finally {
      transitionMap.delete("deco-span" as never);
      decoratorMap.delete("long-dim" as never);
      anchored.mockRestore();
    }
  });
});

describe("the perceptual cut and a PRESENT decorator", () => {
  // The decorator is a full participant, so it gets a full participant's vote:
  // a motion the band math cannot reason about VETOES the early cut, exactly
  // like an unanalyzable part. Cutting a flight while a dim is still visibly
  // moving is the failure this prevents.
  const withDecorator = async (
    decoratorValue: Record<string, string | number>,
    run: (scope: HTMLElement, decorator: HTMLElement, taskId: string) => void
  ) => {
    const { transitionMap } = await import("@transition/transition");
    const { decoratorMap } = await import("@transition/decorator/decorator");
    const createDecorator = (await import("@transition/decorator/createDecorator")).default;
    decoratorMap.set(
      "cut-dim" as never,
      createDecorator({
        name: "cut-dim" as never,
        initial: { opacity: 0 },
        idle: { value: { opacity: 0 }, options: { duration: 0 } },
        enter: { value: decoratorValue, options: { duration: 0.7 } },
        exit: { value: { opacity: 0 }, options: { duration: 0.7 } }
      })
    );
    const base = transitionMap.get("cupertino")!;
    transitionMap.set("cut-deco" as never, { ...base, decoratorName: "cut-dim" } as never);
    const { scope, decorator } = elements();
    Object.defineProperty(scope, "clientWidth", { value: 390, configurable: true });
    Object.defineProperty(scope, "clientHeight", { value: 720, configurable: true });
    document.body.append(scope, decorator);
    try {
      run(scope, decorator, "cut-deco-task");
    } finally {
      transitionMap.delete("cut-deco" as never);
      decoratorMap.delete("cut-dim" as never);
      scope.remove();
      decorator.remove();
    }
  };

  it("cuts when the decorator's own motion is inside its band", async () => {
    vi.useFakeTimers();
    try {
      await withDecorator({ opacity: 0.5 }, (scope, decorator, taskId) => {
        const resolveSpy = vi
          .spyOn(TaskManger, "resolveTask")
          .mockImplementation(() => Promise.resolve(true));
        const d = { ...deps(), getTransitionTaskId: vi.fn(() => taskId as never) };
        const cleanup = createTransitionEngine(d).driveScreenLifecycle({
          getElements: () => ({ scope, decorator, bars: [] }),
          transitionName: "cut-deco" as never,
          prevTransitionName: "cut-deco" as never,
          status: "PUSHING",
          isActive: true,
          animHoldReleased: true
        });
        // Past the sub-pixel point but before the 700ms animationend, which
        // jsdom never fires.
        vi.advanceTimersByTime(720);
        expect(resolveSpy).toHaveBeenCalledWith(taskId);
        cleanup();
        resolveSpy.mockRestore();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does NOT cut when the decorator's motion is unanalyzable", async () => {
    vi.useFakeTimers();
    try {
      // A filter is outside the band math entirely: one veto is enough.
      await withDecorator({ filter: "blur(4px)" }, (scope, decorator, taskId) => {
        const resolveSpy = vi
          .spyOn(TaskManger, "resolveTask")
          .mockImplementation(() => Promise.resolve(true));
        const d = { ...deps(), getTransitionTaskId: vi.fn(() => taskId as never) };
        const cleanup = createTransitionEngine(d).driveScreenLifecycle({
          getElements: () => ({ scope, decorator, bars: [] }),
          transitionName: "cut-deco" as never,
          prevTransitionName: "cut-deco" as never,
          status: "PUSHING",
          isActive: true,
          animHoldReleased: true
        });
        vi.advanceTimersByTime(720);
        // The clean end owns this flight now — no early resolution happened.
        expect(resolveSpy).not.toHaveBeenCalledWith(taskId);
        cleanup();
        resolveSpy.mockRestore();
      });
    } finally {
      vi.useRealTimers();
    }
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
      vi.useRealTimers();
    }
  });
});

describe("reveal-path gate branches", () => {
  const drive = (
    engine: ReturnType<typeof createTransitionEngine>,
    scope: HTMLElement,
    name: string,
    animHoldReleased: boolean
  ) =>
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: name as never,
      prevTransitionName: name as never,
      status: "REPLACING",
      isActive: true,
      animHoldReleased
    });

  it("a variant pair with no animation on either side resolves on a microtask", async () => {
    const TaskManger = (await import("@core/TaskManger")).default;
    const resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    transitionMap.set(
      "rest-pair" as never,
      createTransition({
        name: "rest-pair" as never,
        initial: { x: 0 },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0 } },
        enterBack: { value: { x: 0 }, options: { duration: 0 } },
        exit: { value: { x: 0 }, options: { duration: 0 } },
        exitBack: { value: { x: 0 }, options: { duration: 0 } }
      })
    );
    try {
      const { scope } = elements();
      const d = { ...deps(), getTransitionTaskId: vi.fn(() => "rest-task") };
      const engine = createTransitionEngine(d);
      const cleanup = drive(engine, scope, "rest-pair", true);
      await Promise.resolve();
      await Promise.resolve();
      expect(resolveSpy).toHaveBeenCalledWith("rest-task");
      cleanup();
    } finally {
      transitionMap.delete("rest-pair" as never);
      vi.restoreAllMocks();
    }
  });

  it("a reveal-shaped flight with NO task neither marks nor anchors the gate", async () => {
    const TaskManger = (await import("@core/TaskManger")).default;
    const heldSpy = vi.spyOn(TaskManger, "markGateHeld");
    const anchorSpy = vi.spyOn(TaskManger, "anchorGate");
    transitionMap.set(
      "reveal-taskless" as never,
      createTransition({
        name: "reveal-taskless" as never,
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
      const engine = createTransitionEngine(deps()); // getTransitionTaskId -> null

      // Held: nothing to gate, so no held mark.
      drive(engine, scope, "reveal-taskless", false)();
      expect(heldSpy).not.toHaveBeenCalled();

      // Released: the span arms for the exit motion, but with no task there
      // is nothing to anchor.
      const cleanup = drive(engine, scope, "reveal-taskless", true);
      expect(anchorSpy).not.toHaveBeenCalled();
      cleanup();
    } finally {
      transitionMap.delete("reveal-taskless" as never);
      vi.restoreAllMocks();
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
    // Native-clock surgery (the stall watcher included) arms only for an
    // authored `driver: "native"` pin — the routed non-Blink default runs
    // the compiled animation untouched (see nativeSurgeryAllowed).
    transitionMap.set(
      "stall-surgery-pin" as never,
      createTransition({
        name: "stall-surgery-pin" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.35 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.35 } },
        exit: { value: { x: "-30%" }, options: { duration: 0.35 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.35 } },
        options: { driver: "native" }
      } as never)
    );
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
        transitionName: "stall-surgery-pin" as never,
        prevTransitionName: "stall-surgery-pin" as never,
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
      transitionMap.delete("stall-surgery-pin" as never);
      delete (document.documentElement as unknown as { getAnimations?: unknown }).getAnimations;
      vi.unstubAllGlobals();
    }
  });
});

describe("a flight with no navigation task", () => {
  it("drives the compiled path and writes nothing inline", () => {
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
    // The compiled animation stays untouched.
    expect(scope.style.animation).toBe("");
    cleanup();
    scope.remove();
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
      vi.useRealTimers();
    }
  });

  it("vetoes the cut on an unanalyzable part motion", () => {
    vi.useFakeTimers();
    partTransitionMap.set(
      "scaling-part" as never,
      createPartTransition({
        name: "scaling-part" as never,
        initial: { scale: 0.8 },
        idle: { value: { scale: 1 }, options: { duration: 0 } },
        // The scale has to live on `enter`, which is the variant mountPart
        // exercises (PUSHING-false, animating from `idle`). It used to sit on
        // `initial`, which only the -true side ever reads, so the part under
        // test held a constant 1 and the veto it is named for was coming from
        // a variant that carried a duration and no motion.
        enter: { value: { scale: 0.8 }, options: { duration: 0.3 } },
        exit: { value: { scale: 1 }, options: { duration: 0.3 } }
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
      vi.useRealTimers();
    }
  });
});

describe("choreography-span deferral", () => {
  it("a part authored far longer than its screen is never cut by a fixed cap", () => {
    vi.useFakeTimers();
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
      vi.useRealTimers();
    }
  });

  it("defers the clean-end resolve until the longest part finishes", () => {
    vi.useFakeTimers();
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

    // Pre-release run: the hold arms with the FIRST transitional commit — a
    // commit task landing just before the release frame's vsync would join
    // that frame's rendering update UNHELD and age the compiled clock before
    // first paint (the "gathers then rushes" opening), so pre-release
    // arrivals are held exactly like mid-flight ones.
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
    expect(early.hasAttribute("data-flemo-held-arrival")).toBe(true);

    // Post-release run keeps the same hold; a Suspense-style swap parks.
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

describe("arrival-hold landing placement", () => {
  // The hold lands AT REST — after the COMPLETED flip — on every tier.
  //
  // It used to land EARLY on most of them: at the choreography's visual rest
  // point, so the release commit's layout and paint would hide under the
  // compositor-owned sub-pixel tail. The tail turned out to be exactly where
  // that commit shows (steady-60 desktop: one skipped-frame-class gap, 21-29ms,
  // on essentially every push), and the tiers still landing early were the ones
  // nothing in the evidence made different. This suite pins the removal: a
  // decelerating slide whose rest point falls well before its end must keep the
  // arrival held past that point.
  const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

  it("keeps the arrival held past the visual rest point, landing only at COMPLETED", async () => {
    vi.useFakeTimers();
    transitionMap.set(
      "px-slide" as never,
      createTransition({
        name: "px-slide" as never,
        initial: { x: "320px" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: 0 }, options: { duration: 0.6, ease: EASE } },
        enterBack: { value: { x: "320px" }, options: { duration: 0.6, ease: EASE } },
        exit: { value: { x: "-112px" }, options: { duration: 0.6, ease: EASE } },
        exitBack: { value: { x: 0 }, options: { duration: 0.6, ease: EASE } }
      } as never)
    );
    try {
      const { scope } = elements();
      document.body.appendChild(scope);
      const skeleton = document.createElement("div");
      scope.appendChild(skeleton);
      const engine = createTransitionEngine(deps());
      const drive = (status: "PUSHING" | "COMPLETED") =>
        engine.driveScreenLifecycle({
          getElements: () => ({ scope, decorator: null, bars: [] }),
          transitionName: "px-slide" as never,
          prevTransitionName: "px-slide" as never,
          status,
          isActive: true,
          animHoldReleased: true
        });
      const cleanup = drive("PUSHING");

      const content = document.createElement("article");
      scope.replaceChild(content, skeleton);
      await vi.advanceTimersByTimeAsync(0);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      // The rest point this suite used to land on: real, and well short of the
      // authored end.
      const motion = resolveVariantMotion(transitionMap.get("px-slide" as never)!, "PUSHING-true")!;
      const restMs = perceptualCutMs(motion, { clientWidth: 0, clientHeight: 0 }, 1)!;
      expect(restMs).toBeGreaterThan(0);
      expect(restMs).toBeLessThan(600);

      // Past it — and past the whole motion — the arrival is still held.
      await vi.advanceTimersByTimeAsync(restMs + 40);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);
      expect(skeleton.parentNode).toBe(scope);
      await vi.advanceTimersByTimeAsync(700);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(true);

      // COMPLETED lands it, two frames off the convergence commit.
      cleanup();
      drive("COMPLETED");
      await vi.advanceTimersByTimeAsync(120);
      expect(content.hasAttribute("data-flemo-held-arrival")).toBe(false);
      expect(skeleton.parentNode).toBe(null);
      scope.remove();
    } finally {
      transitionMap.delete("px-slide" as never);
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
