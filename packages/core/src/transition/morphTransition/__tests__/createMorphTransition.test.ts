import { describe, expect, it } from "vitest";

import createMorphTransition from "@transition/morphTransition/createMorphTransition";
import createRawMorphTransition from "@transition/morphTransition/createRawMorphTransition";
import { morphTransitionMap } from "@transition/morphTransition/morphTransition";
import shared from "@transition/morphTransition/shared";
import { MORPH_FROM_VARIANT } from "@transition/morphTransition/typing";

const value = (opacity: number) => ({ value: { opacity }, options: { duration: 0.4 } });

describe("createMorphTransition", () => {
  it("puts the two SIDES of a flight on the active/inactive axis", () => {
    // Not two moments of one element: a morph's `enter` and `exit` are the
    // arriving element and the one it is replacing, animating at the same time.
    const morph = createMorphTransition({
      name: "test",
      initial: { opacity: 0 },
      idle: value(1),
      enter: value(1),
      exit: value(0)
    });

    expect(morph.variants["PUSHING-true"].value.opacity).toBe(1);
    expect(morph.variants["PUSHING-false"].value.opacity).toBe(0);
    // POP is the reversed pair: the dismissing screen keeps the active flag,
    // so the ARRIVING side there is "-false".
    expect(morph.variants["POPPING-true"].value.opacity).toBe(0);
    expect(morph.variants["POPPING-false"].value.opacity).toBe(1);
    expect(morph.variants["REPLACING-true"].value.opacity).toBe(1);
    expect(morph.variants["IDLE-true"].value.opacity).toBe(1);
  });

  it("carries its options onto the definition", () => {
    const morph = createMorphTransition({
      name: "test",
      initial: {},
      idle: value(1),
      enter: value(1),
      exit: value(0),
      options: { crossFade: 0.5, radius: false }
    });

    expect(morph.crossFade).toBe(0.5);
    expect(morph.radius).toBe(false);
  });
});

describe("createRawMorphTransition", () => {
  it("gives every status its own pair of sides", () => {
    const morph = createRawMorphTransition({
      name: "test",
      initial: {},
      idle: value(1),
      pushOnEnter: value(0.1),
      pushOnExit: value(0.2),
      replaceOnEnter: value(0.3),
      replaceOnExit: value(0.4),
      popOnEnter: value(0.5),
      popOnExit: value(0.6)
    });

    expect(morph.variants["PUSHING-true"].value.opacity).toBe(0.1);
    expect(morph.variants["PUSHING-false"].value.opacity).toBe(0.2);
    expect(morph.variants["REPLACING-true"].value.opacity).toBe(0.3);
    expect(morph.variants["REPLACING-false"].value.opacity).toBe(0.4);
    expect(morph.variants["POPPING-true"].value.opacity).toBe(0.6);
    expect(morph.variants["POPPING-false"].value.opacity).toBe(0.5);
  });
});

describe("the morph from-table", () => {
  it("starts the arrival at `initial` on every status, unlike a screen", () => {
    // A screen entering on POP resumes the pose it retreated to. A morph has no
    // such continuity: the arriving element mounts fresh (or wakes from a
    // freeze) every time, so it always begins where `initial` says.
    expect(MORPH_FROM_VARIANT["PUSHING-true"]).toBe("initial");
    expect(MORPH_FROM_VARIANT["REPLACING-true"]).toBe("initial");
    // And on POP the arriving side is "-false", so that is the one that starts
    // from `initial` — the mirror of the reversal in the variant table.
    expect(MORPH_FROM_VARIANT["POPPING-false"]).toBe("initial");
    expect(MORPH_FROM_VARIANT["POPPING-true"]).toBe("IDLE-true");
    expect(MORPH_FROM_VARIANT["IDLE-true"]).toBe("self");
  });
});

describe("the shared preset", () => {
  it("is registered under its name", () => {
    expect(morphTransitionMap.get("shared")).toBe(shared);
  });

  it("authors no duration, so it inherits the flying screen's", () => {
    // The one decision that keeps a morph from needing a transition of its own.
    expect(shared.variants["PUSHING-true"].options.duration).toBeUndefined();
    expect(shared.variants["PUSHING-false"].options.duration).toBeUndefined();
    // And no `initial` opacity: the arrival is opaque from its first frame,
    // and the element it replaces is cut in that same frame. Authoring one
    // together with a `crossFade` window is what turns the swap into a
    // dissolve, for sides whose contents differ enough to want it.
    expect(shared.initial.opacity).toBeUndefined();
    // The window belongs to the GHOST — the copy of what is being replaced,
    // carried inside the flight and dissolved away on top of the real element.
    // Over HALF the flight: what the copy holds is the departure's unpaired
    // content (a paired descendant is already invisible in it), and that
    // content leaving in three frames is what made a pop read as a cut rather
    // than as the reverse of the push.
    expect(shared.crossFade).toBe(0.55);
  });
});
