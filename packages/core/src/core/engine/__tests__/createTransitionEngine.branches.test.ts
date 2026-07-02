import { describe, expect, it, vi } from "vitest";

import { animationName } from "@transition/compileTransitionStyles";

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
      isActive: true
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
      isActive: true
    });
    idleCleanup();

    const noScopeCleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope: null, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true
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
      isActive: false
    });

    expect(d.setReplaceTransitionStatus).toHaveBeenCalledWith("PENDING");
  });

  it("ignores animationend events from other elements or other animations", () => {
    const { scope } = elements();
    const d = deps();
    const engine = createTransitionEngine(d);

    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true
    });

    // Wrong animation name on the right element.
    scope.dispatchEvent(animationEndEvent("not-the-one"));
    // Right name but bubbled from a child.
    const child = document.createElement("div");
    scope.appendChild(child);
    child.dispatchEvent(
      animationEndEvent(animationName("screen", "cupertino", "PUSHING-true"), true)
    );

    expect(d.getTransitionTaskId).not.toHaveBeenCalled();
  });
});
