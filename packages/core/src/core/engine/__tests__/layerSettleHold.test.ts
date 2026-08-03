import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createTransition from "@transition/createTransition";

import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import {
  holdScopeLayer,
  LAYER_SETTLE_MS,
  releaseScopeLayerAfterSettle,
  resetResidentLayersForTesting
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

  it("a rehold into an animation-less variant drops the owner's stake", () => {
    const still = { initial: {}, variants: {} } as Parameters<typeof holdScopeLayer>[1];
    const scope = document.createElement("div");

    // Sole owner: dropping the last stake restores the element immediately —
    // an animation-less flight must not inherit the previous variant's layer.
    const solo = Symbol("solo");
    holdScopeLayer(scope, cupertino(), true, solo);
    expect(scope.style.willChange).not.toBe("");
    holdScopeLayer(scope, still, true, solo);
    expect(scope.style.willChange).toBe("");
    expect(scope.style.contain).toBe("");

    // With a second owner still staked, the union is recomputed without the
    // rehold's stake instead of tearing the layer down under the survivor.
    const engine = Symbol("engine");
    const swipe = Symbol("swipe");
    holdScopeLayer(scope, cupertino(), true, engine);
    holdScopeLayer(scope, cupertino(), false, swipe);
    holdScopeLayer(scope, still, true, engine);
    expect(scope.style.willChange).not.toBe("");
    expect(scope.style.contain).toBe(""); // the survivor never asked for containment
  });

  it("an animation-less hold from a stranger never touches another owner's stamp", () => {
    const still = { initial: {}, variants: {} } as Parameters<typeof holdScopeLayer>[1];
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino(), true, Symbol("holder"));
    const held = scope.style.willChange;

    holdScopeLayer(scope, still, false, Symbol("stranger"));
    expect(scope.style.willChange).toBe(held);
  });

  it("resident diagnostic keeps a SCREEN promoted at rest; bars still demote", () => {
    sessionStorage.setItem("flemo:layers", "resident");
    resetResidentLayersForTesting();
    try {
      const screen = document.createElement("div");
      screen.setAttribute("data-flemo-screen", "");
      holdScopeLayer(screen, cupertino(), true);
      releaseScopeLayerAfterSettle(screen);
      vi.advanceTimersByTime(LAYER_SETTLE_MS * 2);
      expect(screen.style.willChange).toBe("transform"); // resident
      expect(screen.style.contain).toBe(""); // containment still restores

      const bar = document.createElement("div");
      holdScopeLayer(bar, cupertino(), false);
      releaseScopeLayerAfterSettle(bar);
      vi.advanceTimersByTime(LAYER_SETTLE_MS);
      expect(bar.style.willChange).toBe(""); // non-screen demotes normally
    } finally {
      sessionStorage.removeItem("flemo:layers");
      resetResidentLayersForTesting();
    }
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

  it("a duplicate release from the same owner is a no-op (no stack, no reset)", () => {
    const scope = document.createElement("div");
    holdScopeLayer(scope, cupertino());
    releaseScopeLayerAfterSettle(scope); // schedules the settle demote at +300
    vi.advanceTimersByTime(LAYER_SETTLE_MS - 50);
    // The owner already let go; a second release must NOT reset the window or
    // stack a second timer — the demote still lands 300ms after the FIRST.
    releaseScopeLayerAfterSettle(scope);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(49);
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

  it("an ANIMATION-LESS re-hold restores a stale containment pin immediately", () => {
    const scope = document.createElement("div");
    // A push stamps promotion + containment.
    holdScopeLayer(scope, cupertino(), true);
    expect(scope.style.contain).toBe("layout");
    releaseScopeLayerAfterSettle(scope);
    // A rehold whose variant animates NOTHING (properties empty) previously
    // early-returned, leaving push's contain:layout stuck on the element for
    // the whole next flight. It must restore the element now.
    const still = createTransition({
      name: "layer-hold-still-2" as never,
      initial: {},
      idle: { value: {}, options: { duration: 0 } },
      enter: { value: {}, options: { duration: 0.3 } },
      enterBack: { value: {}, options: { duration: 0.3 } },
      exit: { value: {}, options: { duration: 0.3 } },
      exitBack: { value: {}, options: { duration: 0.3 } }
    });
    holdScopeLayer(scope, still, false);
    expect(scope.style.willChange).toBe("");
    expect(scope.style.contain).toBe("");
  });

  it("COMPOSES with the element's OWN inline will-change/contain during the flight", () => {
    const scope = document.createElement("div");
    // Consumer authored these on the same element flemo promotes. Their
    // semantics must SURVIVE the flight (paint keeps clipping overflow, the
    // filter promotion stays), not be replaced for its span.
    scope.style.willChange = "filter";
    scope.style.contain = "paint";
    holdScopeLayer(scope, cupertino(), true);
    expect(scope.style.willChange).toContain("filter");
    expect(scope.style.willChange).toContain("transform");
    expect(scope.style.contain).toBe("paint layout");
    releaseScopeLayerAfterSettle(scope);
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    // Released to the CONSUMER's original values, not deleted.
    expect(scope.style.willChange).toBe("filter");
    expect(scope.style.contain).toBe("paint");
  });

  it("keeps a strict/content containment as-is (layout already implied)", () => {
    const scope = document.createElement("div");
    scope.style.contain = "strict";
    holdScopeLayer(scope, cupertino(), true);
    expect(scope.style.contain).toBe("strict"); // no redundant token appended
    releaseScopeLayerAfterSettle(scope);
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(scope.style.contain).toBe("strict");
  });

  it("a PAST owner from an earlier settle window has no rights over the current one", () => {
    const scope = document.createElement("div");
    const A = Symbol("owner-A");
    const B = Symbol("owner-B");
    // A's window: hold, release (pending scheduled under A).
    holdScopeLayer(scope, cupertino(), false, A);
    releaseScopeLayerAfterSettle(scope, A);
    // B re-promotes inside A's window (legit: the layer is needed again),
    // then releases — the CURRENT window is B's now.
    holdScopeLayer(scope, cupertino(), false, B);
    releaseScopeLayerAfterSettle(scope, B);
    vi.advanceTimersByTime(100);
    // A (whose window ended when B re-promoted) comes back with an
    // animation-less hold: it must NOT cancel B's timer or demote early.
    const still = createTransition({
      name: "layer-hold-still-4" as never,
      initial: {},
      idle: { value: {}, options: { duration: 0 } },
      enter: { value: {}, options: { duration: 0.3 } },
      enterBack: { value: {}, options: { duration: 0.3 } },
      exit: { value: {}, options: { duration: 0.3 } },
      exitBack: { value: {}, options: { duration: 0.3 } }
    });
    holdScopeLayer(scope, still, false, A);
    expect(scope.style.willChange).toBe("transform"); // B's window intact
    vi.advanceTimersByTime(LAYER_SETTLE_MS - 100);
    expect(scope.style.willChange).toBe(""); // B's own clock demotes it
  });

  it("a STRANGER's animation-less hold never cancels another owner's settle timer", () => {
    const scope = document.createElement("div");
    const A = Symbol("owner-A");
    const B = Symbol("owner-B");
    holdScopeLayer(scope, cupertino(), true, A);
    releaseScopeLayerAfterSettle(scope, A); // A's settle window is running
    const still = createTransition({
      name: "layer-hold-still-3" as never,
      initial: {},
      idle: { value: {}, options: { duration: 0 } },
      enter: { value: {}, options: { duration: 0.3 } },
      enterBack: { value: {}, options: { duration: 0.3 } },
      exit: { value: {}, options: { duration: 0.3 } },
      exitBack: { value: {}, options: { duration: 0.3 } }
    });
    // B never held this element; its animation-less hold must be a strict
    // no-op — NOT an immediate demote on A's convergence frames.
    holdScopeLayer(scope, still, false, B);
    expect(scope.style.willChange).toBe("transform"); // A's deferral intact
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(scope.style.willChange).toBe(""); // A's own clock demotes it
  });

  it("refcounts overlapping owners: demotes only after the LAST releases", () => {
    const bar = document.createElement("div");
    const A = Symbol("owner-A");
    const B = Symbol("owner-B");
    holdScopeLayer(bar, cupertino(), false, A);
    holdScopeLayer(bar, cupertino(), false, B);
    expect(bar.style.willChange).toBe("transform");
    // Owner A releases; B is still flying → the layer must survive the window.
    releaseScopeLayerAfterSettle(bar, A);
    vi.advanceTimersByTime(LAYER_SETTLE_MS * 2);
    expect(bar.style.willChange).toBe("transform");
    // B releases → now the settle window runs and demotes.
    releaseScopeLayerAfterSettle(bar, B);
    vi.advanceTimersByTime(LAYER_SETTLE_MS - 1);
    expect(bar.style.willChange).toBe("transform");
    vi.advanceTimersByTime(1);
    expect(bar.style.willChange).toBe("");
  });

  it("a release from an owner that never held is a no-op for other owners", () => {
    const bar = document.createElement("div");
    const A = Symbol("owner-A");
    const B = Symbol("owner-B");
    holdScopeLayer(bar, cupertino(), false, A);
    // B never held this bar (its variant animated nothing); releasing under B
    // must not demote A's still-active layer.
    releaseScopeLayerAfterSettle(bar, B);
    vi.advanceTimersByTime(LAYER_SETTLE_MS * 2);
    expect(bar.style.willChange).toBe("transform");
  });

  it("composes two owners' DIFFERENT requirements as a union, not last-writer", () => {
    const bar = document.createElement("div");
    const A = Symbol("owner-A");
    const B = Symbol("owner-B");
    // Owner A wants transform (+ containment); owner B wants a filter-animating
    // transition (no containment). The applied will-change must be the UNION.
    const filterTx = createTransition({
      name: "layer-hold-filter" as never,
      initial: { filter: "blur(4px)" },
      idle: { value: { filter: "blur(0px)" }, options: { duration: 0 } },
      enter: { value: { filter: "blur(0px)" }, options: { duration: 0.3 } },
      enterBack: { value: { filter: "blur(4px)" }, options: { duration: 0.3 } },
      exit: { value: { filter: "blur(4px)" }, options: { duration: 0.3 } },
      exitBack: { value: { filter: "blur(0px)" }, options: { duration: 0.3 } }
    });
    holdScopeLayer(bar, cupertino(), true, A);
    holdScopeLayer(bar, filterTx, false, B);
    expect(bar.style.willChange).toContain("transform");
    expect(bar.style.willChange).toContain("filter");
    expect(bar.style.contain).toBe("layout"); // OR of containment: A wants it

    // A (the containment owner) releases: the union recomputes to B's filter
    // only, and containment drops — but the layer survives on B.
    releaseScopeLayerAfterSettle(bar, A);
    expect(bar.style.willChange).toBe("filter");
    expect(bar.style.contain).toBe("");
    vi.advanceTimersByTime(LAYER_SETTLE_MS * 2);
    expect(bar.style.willChange).toBe("filter"); // B still flying, no demote

    // B releases → last owner → settle demote.
    releaseScopeLayerAfterSettle(bar, B);
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(bar.style.willChange).toBe("");
  });

  it("two engine instances on one bar refcount independently (nested Routers)", () => {
    // Regression: module-global owner tokens collapsed two engine instances
    // into ONE holder, so the first to finish demoted the shared bar out from
    // under the other. Distinct per-instance owners must refcount.
    const bar = document.createElement("div");
    const routerA = Symbol("engine-A");
    const routerB = Symbol("engine-B");
    holdScopeLayer(bar, cupertino(), false, routerA);
    holdScopeLayer(bar, cupertino(), false, routerB);
    releaseScopeLayerAfterSettle(bar, routerA); // A's flight ends first
    vi.advanceTimersByTime(LAYER_SETTLE_MS * 2);
    expect(bar.style.willChange).toBe("transform"); // B still holds it
    releaseScopeLayerAfterSettle(bar, routerB);
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(bar.style.willChange).toBe("");
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
