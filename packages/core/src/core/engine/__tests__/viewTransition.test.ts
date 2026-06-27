import { afterEach, describe, expect, it, vi } from "vitest";

import createTransition from "@transition/createTransition";

import {
  buildViewTransitionCss,
  getContainerClipRadius,
  runViewTransition,
  supportsViewTransitions
} from "@core/engine/viewTransition";

const transition = createTransition({
  name: "vt-test" as never,
  initial: { filter: "blur(12px)", opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: {
    value: { filter: "blur(0px)", opacity: 1 },
    options: { duration: 0.32, ease: "easeOut" }
  },
  enterBack: { value: { filter: "blur(12px)", opacity: 0 }, options: { duration: 0.3 } },
  exit: { value: { filter: "blur(12px)", opacity: 0 }, options: { duration: 0.32 } },
  exitBack: { value: { opacity: 1 }, options: { duration: 0.3 } }
});

afterEach(() => {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  document.querySelector("#flemo-view-transition")?.remove();
  vi.restoreAllMocks();
});

describe("supportsViewTransitions", () => {
  it("is false without document.startViewTransition", () => {
    expect(supportsViewTransitions()).toBe(false);
  });
  it("is true when document.startViewTransition exists", () => {
    (document as { startViewTransition?: unknown }).startViewTransition = () => ({});
    expect(supportsViewTransitions()).toBe(true);
  });
});

describe("getContainerClipRadius", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the border-radius of the nearest clipping ancestor", () => {
    const frame = document.createElement("div");
    frame.style.overflow = "hidden";
    frame.style.borderRadius = "40px";
    const screen = document.createElement("div");
    screen.setAttribute("data-flemo-screen", "");
    frame.appendChild(screen);
    document.body.appendChild(frame);

    expect(getContainerClipRadius(screen)).toBe("40px");
  });

  it("skips ancestors that don't clip", () => {
    const frame = document.createElement("div");
    frame.style.overflow = "hidden";
    frame.style.borderRadius = "24px";
    const passthrough = document.createElement("div"); // overflow visible
    const screen = document.createElement("div");
    passthrough.appendChild(screen);
    frame.appendChild(passthrough);
    document.body.appendChild(frame);

    expect(getContainerClipRadius(screen)).toBe("24px");
  });

  it("is 0px when there is no clipping ancestor (fullscreen mount)", () => {
    const screen = document.createElement("div");
    document.body.appendChild(screen);
    expect(getContainerClipRadius(screen)).toBe("0px");
  });
});

describe("buildViewTransitionCss", () => {
  it("targets the pseudo-elements with the transition's compiled keyframes", () => {
    const css = buildViewTransitionCss(transition, "PUSHING-true", "PUSHING-false");
    expect(css).toContain("::view-transition-new(flemo-vt-new)");
    expect(css).toContain("::view-transition-old(flemo-vt-old)");
    expect(css).toContain("::view-transition-group(root)");
    expect(css).toContain("flemo-screen-vt-test-PUSHING-true");
    expect(css).toContain("flemo-screen-vt-test-PUSHING-false");
    expect(css).toContain("0.32s");
  });
});

describe("runViewTransition", () => {
  it("falls back to a synchronous commit with no style when unsupported", async () => {
    const commit = vi.fn();
    await runViewTransition("::view-transition-new(x){}", commit);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(document.querySelector("#flemo-view-transition")).toBeNull();
  });

  it("injects the rules, runs the commit, and removes the rules after finish", async () => {
    const commit = vi.fn();
    let injectedDuringCommit: string | null = null;
    (document as { startViewTransition?: unknown }).startViewTransition = (cb: () => void) => {
      cb();
      injectedDuringCommit =
        document.querySelector<HTMLStyleElement>("#flemo-view-transition")?.textContent ?? null;
      return { finished: Promise.resolve() };
    };

    await runViewTransition("::view-transition-new(flemo-vt-new){ animation: x; }", commit);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(injectedDuringCommit).toContain("::view-transition-new(flemo-vt-new)");
    // Cleaned up after `finished`.
    expect(document.querySelector("#flemo-view-transition")).toBeNull();
  });
});
