import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createTransition, decoratorMap, transitionMap } from "@flemo/core";

import useTransitionStyles from "@transition/styles";

declare module "@flemo/core" {
  interface RegisterTransition {
    "uts-fade": "uts-fade";
    "uts-blur": "uts-blur";
  }
}

const fade = createTransition({
  name: "uts-fade",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: { duration: 0.3 } },
  enterBack: { value: { opacity: 0 }, options: { duration: 0.3 } },
  exit: { value: { opacity: 0 }, options: { duration: 0.3 } },
  exitBack: { value: { opacity: 1 }, options: { duration: 0.3 } }
});

const blur = createTransition({
  name: "uts-blur",
  initial: { filter: "blur(8px)" },
  idle: { value: { filter: "blur(0px)" }, options: { duration: 0 } },
  enter: { value: { filter: "blur(0px)" }, options: { duration: 0.3 } },
  enterBack: { value: { filter: "blur(8px)" }, options: { duration: 0.3 } },
  exit: { value: { filter: "blur(8px)" }, options: { duration: 0.3 } },
  exitBack: { value: { filter: "blur(0px)" }, options: { duration: 0.3 } }
});

function Host({
  transitions = [],
  decorators = []
}: {
  transitions?: Parameters<typeof useTransitionStyles>[0];
  decorators?: Parameters<typeof useTransitionStyles>[1];
}) {
  useTransitionStyles(transitions, decorators);
  return <span data-testid="host" />;
}

const styleTag = () => document.head.querySelector<HTMLStyleElement>("style[data-flemo]");

afterEach(() => {
  // Clean up any leftover transitionMap entries from previous tests so the
  // global registry doesn't accumulate.
  transitionMap.delete("uts-fade");
  transitionMap.delete("uts-blur");
  decoratorMap.clear();
  // Reinstall the four built-in transition presets that decorator.test.ts
  // relies on. (Easier than freezing the map.)
  styleTag()?.remove();
});

describe("useTransitionStyles", () => {
  it("injects a <style data-flemo> tag on mount", () => {
    render(<Host transitions={[fade]} />);
    const tag = styleTag();
    expect(tag).not.toBeNull();
    expect(tag?.textContent).toContain("@keyframes flemo-screen-uts-fade-PUSHING-true");
    expect(tag?.textContent).toContain("opacity");
  });

  it("registers the transition into the global transitionMap during the effect", () => {
    render(<Host transitions={[fade]} />);
    expect(transitionMap.get("uts-fade")).toBe(fade);
  });

  it("removes the transition from transitionMap on unmount and rewrites the style tag", () => {
    const { unmount } = render(<Host transitions={[fade]} />);
    expect(transitionMap.get("uts-fade")).toBe(fade);
    unmount();
    expect(transitionMap.get("uts-fade")).toBeUndefined();
    // Style tag's content no longer includes the unmounted transition.
    const tag = styleTag();
    expect(tag?.textContent ?? "").not.toContain("uts-fade");
  });

  it("supports multiple custom transitions in a single mount", () => {
    render(<Host transitions={[fade, blur]} />);
    const css = styleTag()?.textContent ?? "";
    expect(css).toContain("flemo-screen-uts-fade-");
    expect(css).toContain("flemo-screen-uts-blur-");
    expect(css).toContain("filter");
  });

  it("re-uses the same <style> tag instead of stacking duplicates across renders", () => {
    const { rerender } = render(<Host transitions={[fade]} />);
    const initialTag = styleTag();
    rerender(<Host transitions={[fade]} />);
    expect(document.head.querySelectorAll("style[data-flemo]").length).toBe(1);
    expect(styleTag()).toBe(initialTag);
  });
});
