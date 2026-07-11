import { describe, expect, it, vi } from "vitest";

import { animationName } from "@transition/compileTransitionStyles";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { SKIP_ANIMATION_ATTR } from "@core/engine/types";

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
