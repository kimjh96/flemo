import { describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";

import { transitionMap } from "@transition/transition";

import type { Transition } from "@transition/typing";

import {
  collectFlightParts,
  collectScreenParts,
  collectStampedOuterParts,
  collectUnheldOuterParts,
  collectVariantParts,
  statusChoreographySpanMs
} from "@core/engine/flightParticipants";
import { ANIM_HOLD_ATTR, PART_NAME_ATTR, ROUTER_ATTR, SCREEN_ATTR } from "@dom/attributes";

import createPartTransition from "@transition/partTransition/createPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// WHO IS IN THIS FLIGHT. The scoping rules cannot be inferred from DOM
// structure — each screen sits in its own wrapper, a root Router renders no
// container, and two independent Routers may share a parent — so they are
// explicit, and they are what these suites pin.

const el = (attrs: Record<string, string>, tag = "div") => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

const part = (name: string, attrs: Record<string, string> = {}) =>
  el({ [PART_NAME_ATTR]: name, ...attrs });

describe("collectScreenParts", () => {
  it("takes the container's parts, including bar-mounted ones outside the scope", () => {
    const container = el({});
    const scope = el({ [SCREEN_ATTR]: "true" });
    const inScope = part("title");
    const inBar = part("action");
    scope.appendChild(inScope);
    container.append(scope, inBar);
    document.body.appendChild(container);

    expect(collectScreenParts(scope)).toEqual([inScope, inBar]);
    container.remove();
  });

  it("excludes a NESTED screen's parts — they belong to that screen's engine", () => {
    const container = el({});
    const scope = el({ [SCREEN_ATTR]: "true" });
    const own = part("title");
    const nested = el({ [SCREEN_ATTR]: "true" });
    const theirs = part("title");
    nested.appendChild(theirs);
    scope.append(own, nested);
    container.appendChild(scope);
    document.body.appendChild(container);

    expect(collectScreenParts(scope)).toEqual([own]);
    container.remove();
  });

  it("falls back to the scope itself when it has no parent", () => {
    const scope = el({ [SCREEN_ATTR]: "true" });
    const own = part("title");
    scope.appendChild(own);
    expect(collectScreenParts(scope)).toEqual([own]);
  });
});

describe("collectVariantParts", () => {
  it("takes only the parts mirroring this variant's status and active flag", () => {
    const container = el({});
    const scope = el({ [SCREEN_ATTR]: "true" });
    const mine = part("title", { "data-flemo-status": "PUSHING", "data-flemo-active": "true" });
    const otherSide = part("title", {
      "data-flemo-status": "PUSHING",
      "data-flemo-active": "false"
    });
    const otherStatus = part("title", {
      "data-flemo-status": "POPPING",
      "data-flemo-active": "true"
    });
    container.append(scope, mine, otherSide, otherStatus);
    document.body.appendChild(container);

    expect(collectVariantParts(scope, "PUSHING-true")).toEqual([mine]);
    container.remove();
  });
});

describe("collectFlightParts", () => {
  it("scopes by the Router marker, not by DOM ancestry", () => {
    const container = el({});
    const ours = el({ [ROUTER_ATTR]: "root" });
    const scope = el({ [SCREEN_ATTR]: "true" });
    const mine = part("title", { "data-flemo-status": "PUSHING" });
    ours.append(scope, mine);

    const theirRouter = el({ [ROUTER_ATTR]: "nested" });
    const theirs = part("title", { "data-flemo-status": "PUSHING" });
    theirRouter.appendChild(theirs);

    container.append(ours, theirRouter);
    document.body.appendChild(container);

    expect(collectFlightParts(scope, "PUSHING")).toEqual([mine]);
    container.remove();
  });

  it("stays inclusive when either side carries no marker", () => {
    // A binding predating the stamp, or a detached test fixture: over-waiting
    // is a delay, cross-cutting is a truncation.
    const container = el({});
    const scope = el({ [SCREEN_ATTR]: "true" });
    const unmarked = part("title", { "data-flemo-status": "PUSHING" });
    container.append(scope, unmarked);
    document.body.appendChild(container);
    expect(collectFlightParts(scope, "PUSHING")).toEqual([unmarked]);

    // Scope marked, part not: the part still qualifies.
    const marked = el({ [ROUTER_ATTR]: "root" });
    marked.appendChild(scope);
    container.appendChild(marked);
    expect(collectFlightParts(scope, "PUSHING")).toEqual([unmarked]);
    container.remove();
  });
});

describe("the outer-part collectors", () => {
  it("takes flight parts no held element contains, and skips contained ones", () => {
    const container = el({});
    const scope = el({ [SCREEN_ATTR]: "true" });
    const outer = part("chrome", { "data-flemo-status": "PUSHING" });
    const heldCarrier = el({ [ANIM_HOLD_ATTR]: "true" });
    const inside = part("chrome", { "data-flemo-status": "PUSHING" });
    heldCarrier.appendChild(inside);
    container.append(scope, outer, heldCarrier);
    document.body.appendChild(container);

    expect(collectUnheldOuterParts(scope, "PUSHING")).toEqual([outer]);

    outer.setAttribute(ANIM_HOLD_ATTR, "true");
    expect(collectStampedOuterParts(scope)).toEqual([outer]);
    container.remove();
  });
});

describe("statusChoreographySpanMs", () => {
  const name = "participants-test";

  it("takes the longest of both screen variants and its parts", () => {
    const transition = createTransition({
      name: name as never,
      initial: { x: "100%" },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0.3 } },
      enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
      exit: { value: { x: "-30%" }, options: { duration: 0.5 } },
      exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
    }) as Transition;
    transitionMap.set(name as never, transition);
    partTransitionMap.set(
      "long-part" as never,
      createPartTransition({
        name: "long-part" as never,
        initial: { opacity: 1 },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 0 }, options: { duration: 1.2 } },
        exit: { value: { opacity: 1 }, options: { duration: 1.2 } }
      })
    );

    const container = el({});
    const scope = el({ [SCREEN_ATTR]: "true" });
    container.append(
      scope,
      // A part's ENTER state is its screen moving into the background, i.e.
      // PUSHING-false — the passive side is where a part's motion lives.
      part("long-part", { "data-flemo-status": "PUSHING", "data-flemo-active": "false" })
    );
    document.body.appendChild(container);

    // The 1.2s part dominates both 0.3s/0.5s screen variants.
    expect(statusChoreographySpanMs(scope, transition, "PUSHING")).toBeCloseTo(1200, 0);

    container.remove();
    partTransitionMap.delete("long-part" as never);
    transitionMap.delete(name as never);
  });

  it("is zero when nothing in the status animates", () => {
    const still = createTransition({
      name: "participants-still" as never,
      initial: { x: 0 },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0 } },
      enterBack: { value: { x: 0 }, options: { duration: 0 } },
      exit: { value: { x: 0 }, options: { duration: 0 } },
      exitBack: { value: { x: 0 }, options: { duration: 0 } }
    }) as Transition;
    transitionMap.set("participants-still" as never, still);
    const container = el({});
    const scope = el({ [SCREEN_ATTR]: "true" });
    // A part whose definition is not registered, and one whose variant is
    // motionless: neither may raise the span.
    container.append(
      scope,
      part("unregistered", { "data-flemo-status": "PUSHING", "data-flemo-active": "true" })
    );
    document.body.appendChild(container);

    expect(statusChoreographySpanMs(scope, still, "PUSHING")).toBe(0);
    container.remove();
    transitionMap.delete("participants-still" as never);
  });
});
