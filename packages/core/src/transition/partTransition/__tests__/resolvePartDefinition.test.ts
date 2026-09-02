import { afterEach, describe, expect, it } from "vitest";

import createRawPartTransition from "@transition/partTransition/createRawPartTransition";
import {
  partTransitionMap,
  resolvePartDefinition
} from "@transition/partTransition/partTransition";

import type { PartTransitionName } from "@transition/partTransition/typing";

// Every reader of a part's timing goes through resolvePartDefinition, including
// the ones that ask about an element carrying no name at all: the swipe
// controller collects candidates by attribute and an attribute can be absent.

const registered = createRawPartTransition({
  name: "resolve-part-definition-test" as never,
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  pushOnEnter: { value: { opacity: 1 } },
  pushOnExit: { value: { opacity: 0 } },
  replaceOnEnter: { value: { opacity: 1 } },
  replaceOnExit: { value: { opacity: 0 } },
  popOnEnter: { value: { opacity: 0 } },
  popOnExit: { value: { opacity: 1 } },
  completedOnEnter: { value: { opacity: 1 }, options: { duration: 0 } },
  completedOnExit: { value: { opacity: 0 }, options: { duration: 0 } }
});

afterEach(() => {
  partTransitionMap.delete(registered.name as PartTransitionName);
});

describe("resolvePartDefinition", () => {
  it("resolves a registered part against the flight's clock", () => {
    partTransitionMap.set(registered.name as PartTransitionName, registered);

    const resolved = resolvePartDefinition(registered.name, null);

    expect(resolved).toBeDefined();
    expect(resolved?.initial).toEqual({ opacity: 0 });
  });

  it("yields nothing for an element that carries no part name", () => {
    // getAttribute returns null, and a nameless element must not be read as a
    // lookup of the empty string.
    expect(resolvePartDefinition(null, null)).toBeUndefined();
  });

  it("yields nothing for a name nobody registered", () => {
    expect(resolvePartDefinition("never-registered", null)).toBeUndefined();
  });
});
