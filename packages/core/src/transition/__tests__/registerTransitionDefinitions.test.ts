import { describe, expect, it } from "vitest";

import createRawTransition from "@transition/createRawTransition";
import registerTransitionDefinitions from "@transition/registerTransitionDefinitions";
import { transitionMap } from "@transition/transition";

import type { TransitionName, ScreenVariantValue } from "@transition/typing";

import createRawDecorator from "@transition/decorator/createRawDecorator";
import { decoratorMap } from "@transition/decorator/decorator";
import createMorphTransition from "@transition/morphTransition/createMorphTransition";
import { morphTransitionMap } from "@transition/morphTransition/morphTransition";
import createRawPartTransition from "@transition/partTransition/createRawPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

import type { DecoratorName } from "@transition/decorator/typing";
import type { PartTransitionName } from "@transition/partTransition/typing";

const variant: ScreenVariantValue = {
  value: { opacity: 1 },
  options: { duration: 0.2 }
};

const sample = (name: string) =>
  createRawTransition({
    name: name as TransitionName,
    initial: { opacity: 0 },
    idle: variant,
    pushOnEnter: variant,
    pushOnExit: variant,
    replaceOnEnter: variant,
    replaceOnExit: variant,
    popOnEnter: variant,
    popOnExit: variant,
    completedOnEnter: variant,
    completedOnExit: variant
  });

describe("registerTransitionDefinitions (reference-counted)", () => {
  it("keeps a name registered while ANY registrant is still live", () => {
    // Two Routers (zone bouncing mounts several instances) register the SAME
    // transition name. The first one's cleanup — e.g. React <Activity> freezing
    // it — must NOT strip the definition the second is still animating with;
    // that unconditional delete was the "screens stop animating until something
    // remounts" bug.
    const first = registerTransitionDefinitions([sample("shared-zone-step")], []);
    const second = registerTransitionDefinitions([sample("shared-zone-step")], []);

    first();
    expect(transitionMap.has("shared-zone-step" as TransitionName)).toBe(true);

    second();
    expect(transitionMap.has("shared-zone-step" as TransitionName)).toBe(false);
  });

  it("decorators and part-transitions are reference-counted the same way", () => {
    const decorator = createRawDecorator({
      name: "shared-deco" as DecoratorName,
      initial: { opacity: 0 },
      idle: variant,
      pushOnEnter: variant,
      pushOnExit: variant,
      replaceOnEnter: variant,
      replaceOnExit: variant,
      popOnEnter: variant,
      popOnExit: variant,
      completedOnEnter: variant,
      completedOnExit: variant
    });
    const part = createRawPartTransition({
      name: "shared-part" as PartTransitionName,
      initial: { opacity: 0 },
      idle: variant,
      pushOnEnter: variant,
      pushOnExit: variant,
      replaceOnEnter: variant,
      replaceOnExit: variant,
      popOnEnter: variant,
      popOnExit: variant,
      completedOnEnter: variant,
      completedOnExit: variant
    });
    const first = registerTransitionDefinitions([], [decorator], [part]);
    const second = registerTransitionDefinitions([], [decorator], [part]);

    first();
    expect(decoratorMap.has("shared-deco" as DecoratorName)).toBe(true);
    expect(partTransitionMap.has("shared-part" as PartTransitionName)).toBe(true);

    second();
    expect(decoratorMap.has("shared-deco" as DecoratorName)).toBe(false);
    expect(partTransitionMap.has("shared-part" as PartTransitionName)).toBe(false);
  });

  it("registers a morph transition by name, and reference-counts it like the rest", () => {
    // A morph compiles to no CSS at registration — its keyframes need two rects
    // that only a flight produces — so this is a pure name lookup for the morph
    // runtime. Several Routers may still register the same one.
    const morph = createMorphTransition({
      name: "shared-morph" as never,
      initial: {},
      idle: { value: { opacity: 1 }, options: { duration: 0 } },
      enter: { value: { opacity: 1 }, options: { duration: 0.3 } },
      exit: { value: { opacity: 0 }, options: {} }
    });

    const first = registerTransitionDefinitions([], [], [], [morph]);
    const second = registerTransitionDefinitions([], [], [], [morph]);
    expect(morphTransitionMap.has("shared-morph" as never)).toBe(true);

    first();
    expect(morphTransitionMap.has("shared-morph" as never)).toBe(true);
    second();
    expect(morphTransitionMap.has("shared-morph" as never)).toBe(false);
  });

  it("a lone registrant still unregisters on cleanup", () => {
    const cleanup = registerTransitionDefinitions([sample("lonely-step")], []);
    expect(transitionMap.has("lonely-step" as TransitionName)).toBe(true);
    cleanup();
    expect(transitionMap.has("lonely-step" as TransitionName)).toBe(false);
  });
});
