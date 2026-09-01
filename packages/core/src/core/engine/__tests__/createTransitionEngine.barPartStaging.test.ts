import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// THE ENGINE'S HALF OF THE BAR-PART CROSS-FADE.
//
// barPartStaging.ts can lift a part; this is the wiring that decides when. Two
// things have to be true and neither is visible from the staging runtime: it is
// the PASSIVE side that gets staged (the passive screen is the covered one on
// push, pop and replace alike), and the parts come home on the COMPLETED drive.
//
// The fixture is the real binding shape — the shared bar is a SIBLING of the
// scope inside the screen's own wrapper, which is where ScreenMotion renders it.

const animated = createTransition({
  name: "bar-part-staging-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const HOME = "data-flemo-part-home";
const RIDING = "data-flemo-bar-riding";

// jsdom lays nothing out. Staging reads the LAYOUT box for the size and the
// stand-in's rect for the place, so a fixture stands in for both — and the
// stand-in is created by the runtime, so its rect comes from the prototype.
const stubLayout = (element: HTMLElement, x: number, y: number, w: number, h: number) => {
  const rect = {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({})
  } as DOMRect;
  element.getBoundingClientRect = () => rect;
  Object.defineProperty(element, "offsetWidth", { value: w, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: h, configurable: true });
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return this.hasAttribute("data-flemo-part-stand-in") ? rect : original.call(this);
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
};

describe("staging the covered side's shared-bar parts", () => {
  let deps: TransitionEngineDeps;
  let root: HTMLDivElement;
  let scope: HTMLDivElement;
  let bar: HTMLDivElement;
  let barPart: HTMLDivElement;
  let layer: HTMLDivElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let disposers: (() => void)[];
  let engine: ReturnType<typeof createTransitionEngine>;

  beforeEach(() => {
    transitionMap.set("bar-part-staging-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-bar-part"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);

    root = document.createElement("div");
    const wrapper = document.createElement("div");

    scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "screen-1");
    scope.setAttribute("data-flemo-router", "router-1");

    bar = document.createElement("div");
    bar.setAttribute("data-flemo-bar", "app");
    bar.setAttribute("data-flemo-router", "router-1");
    // The partner screen declares the same bar id, so this bar hands over
    // rather than rides — and its parts are the ones meant to cross-fade.
    bar.setAttribute(RIDING, "false");
    barPart = document.createElement("div");
    barPart.setAttribute("data-flemo-part-name", "navigationIcon");
    barPart.setAttribute("data-flemo-router", "router-1");
    barPart.setAttribute("data-flemo-status", "PUSHING");
    barPart.setAttribute("data-flemo-active", "false");
    bar.appendChild(barPart);
    // A real box. jsdom lays nothing out, and staging refuses to place a part
    // it cannot measure — the guard that keeps an Activity-hidden screen's zero
    // rects from pinning its parts to the layer's origin.
    stubLayout(barPart, 20, 28, 40, 40);

    layer = document.createElement("div");

    wrapper.append(scope, bar);
    root.append(wrapper, layer);
    document.body.appendChild(root);

    disposers = [];
    engine = createTransitionEngine(deps);
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    root.remove();
    transitionMap.delete("bar-part-staging-test" as never);
    resolveSpy.mockRestore();
  });

  // One engine per screen for the whole flight, as the binding does.
  const drive = (status: string, isActive: boolean, animHoldReleased = false) => {
    disposers.push(
      engine.driveScreenLifecycle({
        getElements: () => ({ scope, bars: [bar], partLayer: layer }),
        transitionName: "bar-part-staging-test" as never,
        prevTransitionName: "bar-part-staging-test" as never,
        status: status as "PUSHING",
        isActive,
        animHoldReleased
      })
    );
  };

  it("lifts the passive side's matched-bar part on the first transitional drive", () => {
    drive("PUSHING", false);

    expect(barPart.parentElement).toBe(layer);
    expect(barPart.getAttribute(HOME)).toBe("screen-1");
  });

  it("leaves the ACTIVE side's part where it is — that one is already on top", () => {
    drive("PUSHING", true);

    expect(barPart.parentElement).toBe(bar);
  });

  it("stages the returning screen on a pop, which is the passive side there too", () => {
    // data-flemo-active follows the stack, not the direction: a pop's active
    // screen is the DEPARTING top, so the returning screen is the covered one.
    barPart.setAttribute("data-flemo-status", "POPPING");
    drive("POPPING", false);

    expect(barPart.parentElement).toBe(layer);
  });

  it("stages the replaced side too", () => {
    barPart.setAttribute("data-flemo-status", "REPLACING");
    drive("REPLACING", false);

    expect(barPart.parentElement).toBe(layer);
  });

  it("stages once for a flight, not once per hold flip", () => {
    drive("PUSHING", false);
    const home = barPart.getAttribute(HOME);
    drive("PUSHING", false, true);

    expect(barPart.parentElement).toBe(layer);
    expect(barPart.getAttribute(HOME)).toBe(home);
    expect(layer.childElementCount).toBe(1);
  });

  it("brings the part home when the flight completes", () => {
    drive("PUSHING", false);
    drive("COMPLETED", false);

    expect(barPart.parentElement).toBe(bar);
    expect(barPart.hasAttribute(HOME)).toBe(false);
  });

  it("brings a pop's parts home even though that screen is ACTIVE by the landing", () => {
    // The side that staged is the passive one, and on a pop the passive side is
    // the RETURNING screen — which is the top, and therefore active, by the time
    // the flight completes. Releasing from the passive branch never reached it:
    // the parts sat in the layer until the stranded backstop fired seconds
    // later, and the bar they left kept the hole where they had been.
    barPart.setAttribute("data-flemo-status", "POPPING");
    drive("POPPING", false);
    expect(barPart.parentElement).toBe(layer);

    drive("COMPLETED", true);

    expect(barPart.parentElement).toBe(bar);
    expect(barPart.hasAttribute(HOME)).toBe(false);
  });

  it("brings them home on any status that is not a flight", () => {
    drive("PUSHING", false);
    drive("IDLE", false);

    expect(barPart.parentElement).toBe(bar);
  });

  it("stages again on the next flight after landing", () => {
    drive("PUSHING", false);
    drive("COMPLETED", false);
    drive("POPPING", false);

    expect(barPart.parentElement).toBe(layer);
  });

  it("leaves a riding bar's parts in the screen carrying them", () => {
    bar.setAttribute(RIDING, "true");
    drive("PUSHING", false);

    expect(barPart.parentElement).toBe(bar);
  });

  it("stages nothing for a binding that renders no part layer", () => {
    disposers.push(
      engine.driveScreenLifecycle({
        getElements: () => ({ scope, bars: [bar] }),
        transitionName: "bar-part-staging-test" as never,
        prevTransitionName: "bar-part-staging-test" as never,
        status: "PUSHING",
        isActive: false,
        animHoldReleased: false
      })
    );

    expect(barPart.parentElement).toBe(bar);
  });
});
