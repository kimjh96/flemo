import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// A <Part> mounted OUTSIDE any screen — persistent chrome beside a <Slot>, a
// portal — is a flight participant (collectScreenParts admits it) but has no
// held ancestor, so the compiled hold rule's DESCENDANT selector never reached
// it. It animated through the hold window while every screen was parked, then
// led the flight by the whole hold: the defect the decorator once had ("the dim
// faded in ahead of the held screens").

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

describe("outer <Part> hold mirroring", () => {
  let deps: TransitionEngineDeps;
  let container: HTMLDivElement;
  let scope: HTMLDivElement;
  let outerPart: HTMLDivElement;
  let innerPart: HTMLDivElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let disposers: (() => void)[];

  beforeEach(() => {
    transitionMap.set("outer-part-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-outer-part"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);

    container = document.createElement("div");
    scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "");
    // The screen renders its own hold; a Part inside it is covered by the
    // compiled rule's descendant selector.
    scope.setAttribute(HOLD, "park");
    innerPart = document.createElement("div");
    innerPart.setAttribute("data-flemo-part-name", "inner");
    scope.appendChild(innerPart);
    // Persistent chrome: a sibling of the screen, inside no screen at all.
    outerPart = document.createElement("div");
    outerPart.setAttribute("data-flemo-part-name", "header");
    container.append(outerPart, scope);
    document.body.appendChild(container);
    disposers = [];
    engine = createTransitionEngine(deps);
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    container.remove();
    transitionMap.delete("outer-part-test" as never);
    resolveSpy.mockRestore();
  });

  // One engine per screen for the whole flight, as the binding does.
  let engine: ReturnType<typeof createTransitionEngine>;

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

  it("holds an outside-the-screen part for the hold window", () => {
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

  it("only the ACTIVE side stamps, so two screens cannot fight over one element", () => {
    drive(false, false, "POPPING");
    expect(outerPart.hasAttribute(HOLD)).toBe(false);
  });
});
