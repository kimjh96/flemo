import { describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";
import registerTransitionDefinitions from "@transition/registerTransitionDefinitions";
import { transitionMap } from "@transition/transition";

declare module "@transition/typing" {
  interface RegisterTransition {
    "register-test-slide": "register-test-slide";
  }
}

const slide = createTransition({
  name: "register-test-slide",
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: 0 }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: "100%" }, options: { duration: 0.3 } }
});

describe("registerTransitionDefinitions", () => {
  it("registers definitions, writes the stylesheet, and the cleanup unregisters", () => {
    expect(transitionMap.has("register-test-slide")).toBe(false);

    const cleanup = registerTransitionDefinitions([slide], []);

    expect(transitionMap.get("register-test-slide")).toBe(slide);
    const tag = document.head.querySelector("style[data-flemo]");
    expect(tag).not.toBeNull();
    expect(tag!.textContent).toContain("register-test-slide");

    cleanup();

    expect(transitionMap.has("register-test-slide")).toBe(false);
    expect(document.head.querySelector("style[data-flemo]")!.textContent).not.toContain(
      "register-test-slide"
    );
  });
});
