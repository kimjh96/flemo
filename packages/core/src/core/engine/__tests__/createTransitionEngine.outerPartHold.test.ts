import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// A <Part> mounted OUTSIDE any screen — persistent chrome beside a <Slot>, a
// portal — is driven by this flight's compiled keyframes (the part selector
// keys on name + status + active, with no structural term) while nothing
// pauses it: the compiled hold rule reaches a held element's DESCENDANTS, and
// this part descends from neither a screen nor a shared bar. It ran through
// the whole hold window with every screen parked, then led the flight by the
// hold's length — the defect the decorator once had ("the dim faded in ahead
// of the held screens", 2026-08-13).
//
// The fixture below is the REAL binding shape, and the distinction matters:
// each screen sits in its OWN wrapper inside the Slot, so an outer part is not
// reachable by any walk up from the scope. A part synthesized as a sibling of
// the scope models a SHARED BAR instead — and bars already carry the hold from
// the binding, so that shape would pass while nothing real was covered.

const animated = createTransition({
  name: "outer-part-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const HOLD = "data-flemo-anim-hold";
const ROUTER = "data-flemo-router";

const part = (name: string, routerId: string, status = "PUSHING"): HTMLDivElement => {
  const element = document.createElement("div");
  element.setAttribute("data-flemo-part-name", name);
  element.setAttribute(ROUTER, routerId);
  element.setAttribute("data-flemo-status", status);
  element.setAttribute("data-flemo-active", "true");
  return element;
};

describe("outer <Part> hold mirroring", () => {
  let deps: TransitionEngineDeps;
  let root: HTMLDivElement;
  let scope: HTMLDivElement;
  let outerPart: HTMLDivElement;
  let innerPart: HTMLDivElement;
  let barPart: HTMLDivElement;
  let foreignPart: HTMLDivElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let disposers: (() => void)[];
  let engine: ReturnType<typeof createTransitionEngine>;

  beforeEach(() => {
    transitionMap.set("outer-part-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-outer-part"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);

    root = document.createElement("div");

    // Persistent chrome: outside the Slot entirely, inside no screen.
    outerPart = part("header", "router-1");
    // Another Router's chrome, sharing the DOM parent — the case structure
    // alone cannot separate, which is why the marker exists.
    foreignPart = part("header", "router-2");

    const slot = document.createElement("div");
    // Each screen gets its own wrapper; the two screens of one flight share no
    // parent, so the wrapper is NOT a flight-wide container.
    const wrapper = document.createElement("div");
    const bar = document.createElement("div");
    bar.setAttribute("data-flemo-bar", "app");
    bar.setAttribute(HOLD, "true");
    barPart = part("bar-title", "router-1");
    bar.appendChild(barPart);

    scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "");
    scope.setAttribute(ROUTER, "router-1");
    // The screen renders its own hold; a Part inside it is covered by the
    // compiled rule's descendant selector.
    scope.setAttribute(HOLD, "park");
    innerPart = part("title", "router-1");
    scope.appendChild(innerPart);

    wrapper.append(bar, scope);
    slot.appendChild(wrapper);
    root.append(outerPart, foreignPart, slot);
    document.body.appendChild(root);

    disposers = [];
    engine = createTransitionEngine(deps);
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    root.remove();
    transitionMap.delete("outer-part-test" as never);
    resolveSpy.mockRestore();
  });

  // One engine per screen for the whole flight, as the binding does.
  const drive = (animHoldReleased: boolean, isActive = true, status = "PUSHING") => {
    disposers.push(
      engine.driveScreenLifecycle({
        getElements: () => ({ scope }),
        transitionName: "outer-part-test" as never,
        prevTransitionName: "outer-part-test" as never,
        status: status as "PUSHING",
        isActive,
        animHoldReleased
      })
    );
  };

  it("holds a part outside the Slot for the hold window", () => {
    drive(false);
    expect(outerPart.getAttribute(HOLD)).toBe("true");
  });

  it("releases it again, leaving no attribute behind on persistent chrome", () => {
    drive(false);
    drive(true);
    expect(outerPart.hasAttribute(HOLD)).toBe(false);
  });

  it("leaves a part inside the screen alone — the descendant rule owns it", () => {
    drive(false);
    // Stamping it would be redundant, and removing it later could fight the
    // screen's own attribute.
    expect(innerPart.hasAttribute(HOLD)).toBe(false);
  });

  it("leaves a part inside a shared bar alone — the bar already carries the hold", () => {
    drive(false);
    expect(barPart.hasAttribute(HOLD)).toBe(false);
  });

  it("ignores a part owned by another Router that shares the DOM parent", () => {
    drive(false);
    expect(foreignPart.hasAttribute(HOLD)).toBe(false);
  });

  it("only the ACTIVE side stamps, so two screens cannot fight over one element", () => {
    drive(false, false, "POPPING");
    expect(outerPart.hasAttribute(HOLD)).toBe(false);
  });

  it("sweeps a stamp whose part has already moved past this flight's status", () => {
    drive(false);
    // The part's own status attribute can advance in a different commit than
    // this drive; the release must still find it, or the pause outlives the
    // flight on persistent chrome.
    outerPart.setAttribute("data-flemo-status", "COMPLETED");
    drive(true);
    expect(outerPart.hasAttribute(HOLD)).toBe(false);
  });
});
