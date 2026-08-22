import { afterEach, beforeEach, describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";

import { transitionMap } from "@transition/transition";

import type { Transition } from "@transition/typing";

import { holdParticipantLayers, releaseParticipantLayers } from "@core/engine/participantLayers";
import { BAR_RIDING_ATTR, PART_NAME_ATTR, SCREEN_ATTR } from "@dom/attributes";

import { reportDisplayIntervalMs, resetDisplayCadenceForTests } from "@platform/displayCadence";

import createPartTransition from "@transition/partTransition/createPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// The compositor-layer lease. The compiled variant rules promote each
// participant with `will-change`, and that promotion un-matches at the
// COMPLETED flip — demoting and repainting a layer on exactly the frames the
// eye is watching settle. So the engine pins the promotion inline for the
// flight and releases it off-cadence afterwards.
//
// The landing governor's inline easing rides the same lease, which is what
// makes a superseded stamp releasable instead of left to bend the next
// variant's curve.

// The authored curve the landing governor was tuned against.
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

const NAME = "layers-test";
const owner = Symbol("test-owner");

const slide = () =>
  createTransition({
    name: NAME as never,
    initial: { x: "100%" },
    idle: { value: { x: 0 }, options: { duration: 0 } },
    enter: { value: { x: 0 }, options: { duration: 0.7, ease: EASE } },
    enterBack: { value: { x: "100%" }, options: { duration: 0.7, ease: EASE } },
    exit: { value: { x: "-30%" }, options: { duration: 0.7, ease: EASE } },
    exitBack: { value: { x: 0 }, options: { duration: 0.7, ease: EASE } }
  }) as Transition;

const wide = (node: HTMLElement) => {
  Object.defineProperty(node, "clientWidth", { value: 1400, configurable: true });
  Object.defineProperty(node, "clientHeight", { value: 800, configurable: true });
  return node;
};

/** Touch Blink at a genuine high-refresh cadence: where the governor engages. */
const asGovernedBlink = () => {
  Object.defineProperty(navigator, "userAgentData", {
    value: { brands: [{ brand: "Chromium", version: "120" }] },
    configurable: true
  });
  Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
  reportDisplayIntervalMs(1000 / 120);
};

let container: HTMLElement;

beforeEach(() => {
  transitionMap.set(NAME as never, slide());
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  transitionMap.delete(NAME as never);
  partTransitionMap.delete("layers-part" as never);
  delete (navigator as { userAgentData?: unknown }).userAgentData;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  resetDisplayCadenceForTests();
});

describe("holdParticipantLayers", () => {
  it("promotes the scope, its RIDING bars and the decorator — but not a non-riding bar", () => {
    const scope = wide(document.createElement("div"));
    scope.setAttribute(SCREEN_ATTR, "true");
    const riding = document.createElement("div");
    riding.setAttribute(BAR_RIDING_ATTR, "true");
    const parked = document.createElement("div");
    const decorator = document.createElement("div");
    container.append(scope, riding, parked, decorator);

    holdParticipantLayers(
      { scope, decorator, bars: [riding, parked, null] },
      transitionMap.get(NAME as never)!,
      "PUSHING-true",
      owner
    );

    expect(scope.style.willChange).not.toBe("");
    expect(riding.style.willChange).not.toBe("");
    expect(parked.style.willChange).toBe(""); // it does not run the screen's rule
  });

  it("stamps one shared governed easing on the scope and its riding bar", () => {
    asGovernedBlink();
    const scope = wide(document.createElement("div"));
    scope.setAttribute(SCREEN_ATTR, "true");
    const riding = wide(document.createElement("div"));
    riding.setAttribute(BAR_RIDING_ATTR, "true");
    container.append(scope, riding);

    holdParticipantLayers(
      { scope, decorator: null, bars: [riding] },
      transitionMap.get(NAME as never)!,
      "PUSHING-true",
      owner
    );

    // ONE string, shared: a riding bar runs the screen's own keyframes, so the
    // pair has to be reshaped identically or it drifts apart mid-flight.
    expect(scope.style.animationTimingFunction).toMatch(/^linear\(/);
    expect(riding.style.animationTimingFunction).toBe(scope.style.animationTimingFunction);
  });

  it("governs a <Part> from its OWN motion and box, not the screen's", () => {
    asGovernedBlink();
    partTransitionMap.set(
      "layers-part" as never,
      createPartTransition({
        name: "layers-part" as never,
        initial: { x: "100%" },
        idle: { value: { x: 0 }, options: { duration: 0 } },
        enter: { value: { x: "-100%" }, options: { duration: 0.7, ease: EASE } },
        exit: { value: { x: 0 }, options: { duration: 0.7, ease: EASE } }
      })
    );

    const scope = document.createElement("div");
    scope.setAttribute(SCREEN_ATTR, "true");
    // A part's ENTER state is its screen moving into the background, so its
    // motion lives on the PASSIVE variant.
    const part = wide(document.createElement("div"));
    part.setAttribute(PART_NAME_ATTR, "layers-part");
    part.setAttribute("data-flemo-status", "PUSHING");
    part.setAttribute("data-flemo-active", "false");
    container.append(scope, part);

    holdParticipantLayers(
      { scope, decorator: null, bars: [] },
      transitionMap.get(NAME as never)!,
      "PUSHING-false",
      owner
    );

    // The screen's own passive travel is too short to govern; the part's is
    // not, and each is judged against its own box.
    expect(scope.style.animationTimingFunction).toBe("");
    expect(part.style.animationTimingFunction).toMatch(/^linear\(/);
    expect(part.style.willChange).not.toBe("");
  });

  it("stamps no easing where the governor does not engage", () => {
    const scope = wide(document.createElement("div"));
    scope.setAttribute(SCREEN_ATTR, "true");
    container.append(scope);

    // No bar list at all: the same shape a decorator-less passive side hands in.
    holdParticipantLayers(
      { scope, decorator: null },
      transitionMap.get(NAME as never)!,
      "PUSHING-true",
      owner
    );

    // WebKit, and Blink at 60Hz, both leave the authored easing alone.
    expect(scope.style.animationTimingFunction).toBe("");
  });
});

describe("releaseParticipantLayers", () => {
  it("releases every participant, and no-ops on unstamped or absent ones", () => {
    const scope = document.createElement("div");
    scope.setAttribute(SCREEN_ATTR, "true");
    const riding = document.createElement("div");
    riding.setAttribute(BAR_RIDING_ATTR, "true");
    const decorator = document.createElement("div");
    const part = document.createElement("div");
    part.setAttribute(PART_NAME_ATTR, "layers-part");
    container.append(scope, riding, decorator, part);

    holdParticipantLayers(
      { scope, decorator, bars: [riding] },
      transitionMap.get(NAME as never)!,
      "PUSHING-true",
      owner
    );
    expect(scope.style.willChange).not.toBe("");

    // Unstamped elements and holes in the bar list must not throw.
    expect(() =>
      releaseParticipantLayers({ scope, decorator, bars: [riding, null, undefined] }, owner)
    ).not.toThrow();
    // A release with no scope and no bar list at all is the passive-teardown
    // shape — the caller does not always have elements to hand back.
    expect(() => releaseParticipantLayers({}, owner)).not.toThrow();
  });
});
