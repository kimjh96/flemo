import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createTransition from "@transition/createTransition";

import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import {
  holdScopeLayer,
  LAYER_SETTLE_MS,
  releaseScopeLayerAfterSettle
} from "@core/engine/layerSettleHold";
import createPartTransition from "@transition/partTransition/createPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// The deferred compositor-layer demotion (layerSettleHold.ts): the compiled
// rules' will-change is pinned inline for the flight so the COMPLETED flip's
// rule un-match cannot demote-and-repaint the layer on the convergence
// frames; the layer releases on its own clock, LAYER_SETTLE_MS past rest.

const deps = () => ({
  getTransitionTaskId: vi.fn(() => null),
  setDragStatus: vi.fn(),
  setReplaceTransitionStatus: vi.fn()
});

const cupertino = () => transitionMap.get("cupertino")!;

describe("layerSettleHold", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stamps the transition's animated properties inline", () => {
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino());
    expect(scope.style.willChange).toBe("transform");
  });

  it("a transition that animates nothing leaves no stamp", () => {
    const still = createTransition({
      name: "layer-hold-still" as never,
      initial: {},
      idle: { value: {}, options: { duration: 0 } },
      enter: { value: {}, options: { duration: 0.3 } },
      enterBack: { value: {}, options: { duration: 0.3 } },
      exit: { value: {}, options: { duration: 0.3 } },
      exitBack: { value: {}, options: { duration: 0.3 } }
    });
    const scope = document.createElement("div");
    holdScopeLayer(scope, still);
    expect(scope.style.willChange).toBe("");
  });

  it("release keeps the layer through the settle window, then demotes", () => {
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino());
    releaseScopeLayerAfterSettle(scope);
    // Immediately after COMPLETED: still promoted — the whole point.
    expect(scope.style.willChange).toBe("transform");
    vi.advanceTimersByTime(LAYER_SETTLE_MS - 1);
    expect(scope.style.willChange).toBe("transform");
    vi.advanceTimersByTime(1);
    expect(scope.style.willChange).toBe("");
  });

  it("release on an unstamped scope is a no-op", () => {
    const scope = document.createElement("div");
    releaseScopeLayerAfterSettle(scope);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a re-hold inside the settle window cancels the pending demotion", () => {
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino());
    releaseScopeLayerAfterSettle(scope);
    // A navigation starting back into the scope keeps the layer.
    holdScopeLayer(scope, cupertino());
    vi.advanceTimersByTime(LAYER_SETTLE_MS * 2);
    expect(scope.style.willChange).toBe("transform");
  });

  it("a re-release replaces the pending timer instead of stacking", () => {
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino());
    releaseScopeLayerAfterSettle(scope);
    vi.advanceTimersByTime(LAYER_SETTLE_MS - 50);
    releaseScopeLayerAfterSettle(scope);
    // The fresh window counts from the second release.
    vi.advanceTimersByTime(LAYER_SETTLE_MS - 1);
    expect(scope.style.willChange).toBe("transform");
    vi.advanceTimersByTime(1);
    expect(scope.style.willChange).toBe("");
  });

  it("pins the rules' containment alongside the promotion and releases both together", () => {
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino(), true);
    expect(scope.style.willChange).toBe("transform");
    expect(scope.style.contain).toBe("layout");
    releaseScopeLayerAfterSettle(scope);
    vi.advanceTimersByTime(LAYER_SETTLE_MS - 1);
    expect(scope.style.contain).toBe("layout");
    vi.advanceTimersByTime(1);
    expect(scope.style.willChange).toBe("");
    expect(scope.style.contain).toBe("");
  });

  it("a containment-less re-hold strips a stale containment pin (push landing into pop)", () => {
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino(), true);
    releaseScopeLayerAfterSettle(scope);
    // A pop starting inside the settle window keeps the layer but must not
    // inherit push's containment — pop's compiled rules omit it.
    holdScopeLayer(scope, cupertino(), false);
    expect(scope.style.willChange).toBe("transform");
    expect(scope.style.contain).toBe("");
    vi.advanceTimersByTime(LAYER_SETTLE_MS * 2);
    expect(scope.style.willChange).toBe("transform");
  });
});

describe("engine wiring", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const drive = (
    engine: ReturnType<typeof createTransitionEngine>,
    scope: HTMLElement,
    status: "PUSHING" | "POPPING" | "COMPLETED",
    isActive: boolean,
    elements?: { decorator?: HTMLElement | null; bars?: (HTMLElement | null)[] }
  ) =>
    engine.driveScreenLifecycle({
      getElements: () => ({
        scope,
        decorator: elements?.decorator ?? null,
        bars: elements?.bars ?? []
      }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status,
      isActive,
      animHoldReleased: true
    });

  it("an active push stamps the scope (promotion + containment) and COMPLETED demotes it off-cadence", () => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    const engine = createTransitionEngine(deps());

    const cleanup = drive(engine, scope, "PUSHING", true);
    expect(scope.style.willChange).toBe("transform");
    // Push rules carry `contain: layout` — its un-match relayout must ride
    // the same deferred clock as the demotion.
    expect(scope.style.contain).toBe("layout");
    cleanup();
    // The stamp survives the transitional effect's own cleanup — it must
    // outlive the COMPLETED flip's commit.
    expect(scope.style.willChange).toBe("transform");

    drive(engine, scope, "COMPLETED", true);
    expect(scope.style.willChange).toBe("transform");
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(scope.style.willChange).toBe("");
    expect(scope.style.contain).toBe("");
    scope.remove();
  });

  it("a passive side stamps too and demotes after its COMPLETED (the pop-returning screen)", () => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    const engine = createTransitionEngine(deps());

    drive(engine, scope, "POPPING", false);
    expect(scope.style.willChange).toBe("transform");
    // Pop rules compile no containment, so none is pinned.
    expect(scope.style.contain).toBe("");

    drive(engine, scope, "COMPLETED", false);
    expect(scope.style.willChange).toBe("transform");
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(scope.style.willChange).toBe("");
    scope.remove();
  });

  it("the decorator and a riding bar stamp with their own rules and demote off-cadence", () => {
    const scope = document.createElement("div");
    const decorator = document.createElement("div");
    const ridingBar = document.createElement("div");
    ridingBar.setAttribute("data-flemo-bar-riding", "true");
    const idleBar = document.createElement("div");
    document.body.append(scope, decorator, ridingBar, idleBar);
    const engine = createTransitionEngine(deps());

    drive(engine, scope, "PUSHING", false, { decorator, bars: [ridingBar, idleBar, null] });
    // cupertino's overlay decorator dims via opacity — its own property
    // list, not the screen's.
    expect(decorator.style.willChange).toBe("opacity");
    // A riding bar runs the screen's rule, so it shares the screen's list;
    // a non-riding bar has no rule to pin.
    expect(ridingBar.style.willChange).toBe("transform");
    expect(idleBar.style.willChange).toBe("");

    drive(engine, scope, "COMPLETED", false, { decorator, bars: [ridingBar, idleBar, null] });
    expect(decorator.style.willChange).toBe("opacity");
    expect(ridingBar.style.willChange).toBe("transform");
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(decorator.style.willChange).toBe("");
    expect(ridingBar.style.willChange).toBe("");
    scope.remove();
    decorator.remove();
    ridingBar.remove();
    idleBar.remove();
  });

  it("this screen's <Part> elements stamp with their own definitions and demote off-cadence", () => {
    const container = document.createElement("div");
    const scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "true");
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", "settle-title");
    part.setAttribute("data-flemo-status", "PUSHING");
    part.setAttribute("data-flemo-active", "false");
    container.append(scope, part);
    document.body.appendChild(container);
    partTransitionMap.set(
      "settle-title" as never,
      createPartTransition({
        name: "settle-title" as never,
        initial: { opacity: 1 },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 0 }, options: { duration: 0.3 } },
        exit: { value: { opacity: 1 }, options: { duration: 0.3 } }
      })
    );
    const engine = createTransitionEngine(deps());

    drive(engine, scope, "PUSHING", false);
    expect(part.style.willChange).toBe("opacity");

    part.setAttribute("data-flemo-status", "COMPLETED");
    drive(engine, scope, "COMPLETED", false);
    expect(part.style.willChange).toBe("opacity");
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(part.style.willChange).toBe("");

    container.remove();
    partTransitionMap.delete("settle-title" as never);
  });
});
