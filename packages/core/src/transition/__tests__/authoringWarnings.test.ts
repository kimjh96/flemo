import { afterEach, describe, expect, it, vi } from "vitest";

import createNavigateStore from "@navigate/store";

import type { TransitionTarget } from "@transition/cssTypes";
import cupertino from "@transition/cupertino";
import none from "@transition/none";
import registerTransitionDefinitions from "@transition/registerTransitionDefinitions";
import { transitionMap } from "@transition/transition";

import { resetDevWarningsForTesting } from "@utils/devWarn";

import { ACTIVE_ATTR, SCREEN_ATTR, STATUS_ATTR, TRANSITION_ATTR } from "@dom/attributes";
import attachMorph from "@morph/attachMorph";
import { registerMorphLayer } from "@morph/morphLayer";
import createMorphTransition from "@transition/morphTransition/createMorphTransition";
import { morphTransitionMap } from "@transition/morphTransition/morphTransition";

// AUTHORING MISTAKES THAT USED TO BE SILENT.
//
// Both of these compile, typecheck, animate, and look wrong. They are the two
// this repository actually made on its own playground: an `exit` pose that
// keeps the departure on glass for the whole flight, and a camera paired with
// a screen that also moves. Neither had anything to fail, so both shipped for
// a day and were found by eye.
const morph = (exit: TransitionTarget) =>
  createMorphTransition({
    name: `probe-${JSON.stringify(exit)}`,
    initial: {},
    idle: { value: { opacity: 1 }, options: { duration: 0 } },
    enter: { value: { opacity: 1 }, options: { duration: 0.3 } },
    exit: { value: exit, options: { duration: 0.3 } }
  });

// jsdom measures nothing, and the camera is chosen by comparing the two boxes,
// so both ends are given one.
const boxed = (element: HTMLElement, x: number, y: number, width: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({})
    }) as DOMRect;
  return element;
};

const screenOn = (transition: string, active: boolean) => {
  const screen = document.createElement("div");
  screen.setAttribute(SCREEN_ATTR, "");
  screen.setAttribute(TRANSITION_ATTR, transition);
  screen.setAttribute(STATUS_ATTR, "COMPLETED");
  screen.setAttribute(ACTIVE_ATTR, active ? "true" : "false");
  boxed(screen, 0, 0, 400, 800);
  document.body.appendChild(screen);
  return screen;
};

// One flight of a camera morph under the named screen transition, which is the
// only way to reach the check: `screenMoves` is read from the DEFINITION the
// owner's attribute names, not from the element.
const flyCamera = (transitionName: string) => {
  const store = createNavigateStore();
  const layer = document.createElement("div");
  document.body.appendChild(layer);
  registerMorphLayer(store, layer);

  const gallery = screenOn(transitionName, false);
  const detail = screenOn(transitionName, true);
  const cell = boxed(gallery.appendChild(document.createElement("div")), 10, 20, 80, 80);
  const hero = boxed(detail.appendChild(document.createElement("div")), 0, 0, 400, 300);

  attachMorph(cell, { layoutId: "hero", name: "camera-probe", navigateStore: store });
  store.getState().setStatus("PUSHING");
  attachMorph(hero, { layoutId: "hero", name: "camera-probe", navigateStore: store });

  registerMorphLayer(store, null);
};

describe("morph authoring warnings", () => {
  afterEach(() => {
    resetDevWarningsForTesting();
    vi.restoreAllMocks();
    transitionMap.clear();
    morphTransitionMap.clear();
    document.body.innerHTML = "";
  });

  it("says when an `exit` pose leaves the departure painted", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const release = registerTransitionDefinitions([], [], [], [morph({ opacity: 1 })]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("leaves its departure visible");
    release();
  });

  it("says when an `exit` pose names no opacity at all", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const release = registerTransitionDefinitions([], [], [], [morph({ scale: 0.9 })]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("no opacity");
    release();
  });

  it("stays quiet for the pose every preset writes", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const release = registerTransitionDefinitions([], [], [], [morph({ opacity: 0 })]);
    expect(error).not.toHaveBeenCalled();
    release();
  });

  it("says when a camera is paired with a screen that moves itself", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    transitionMap.set("cupertino", cupertino);
    morphTransitionMap.set("camera-probe", {
      ...morph({ opacity: 0 }),
      name: "camera-probe",
      carry: "screen"
    });

    flyCamera("cupertino");

    const lines = error.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes("carries a camera"))).toBe(true);
    expect(lines.some((line) => line.includes('"cupertino" moves the screen itself'))).toBe(true);
  });

  it("says it once for the pair, however many flights run", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    transitionMap.set("cupertino", cupertino);
    morphTransitionMap.set("camera-probe", {
      ...morph({ opacity: 0 }),
      name: "camera-probe",
      carry: "screen"
    });

    flyCamera("cupertino");
    flyCamera("cupertino");

    expect(error.mock.calls.filter((call) => String(call[0]).includes("carries a camera"))).toEqual(
      [expect.anything()]
    );
  });

  it("stays quiet for the still transition a camera is meant to be paired with", () => {
    // `none` is the pairing `zoom`'s own comment prescribes: the camera IS the
    // screen's motion for the flight, so there is nothing to supersede.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    transitionMap.set("none", none);
    morphTransitionMap.set("camera-probe", {
      ...morph({ opacity: 0 }),
      name: "camera-probe",
      carry: "screen"
    });

    flyCamera("none");

    expect(error.mock.calls.map((call) => String(call[0])).join(" ")).not.toContain(
      "carries a camera"
    );
  });
});
