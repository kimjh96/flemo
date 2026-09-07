import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransitionTarget } from "@transition/cssTypes";
import registerTransitionDefinitions from "@transition/registerTransitionDefinitions";

import { resetDevWarningsForTesting } from "@utils/devWarn";

import createMorphTransition from "@transition/morphTransition/createMorphTransition";

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

describe("morph authoring warnings", () => {
  afterEach(() => {
    resetDevWarningsForTesting();
    vi.restoreAllMocks();
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
});
