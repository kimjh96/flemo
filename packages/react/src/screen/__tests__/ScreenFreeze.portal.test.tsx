import { act, useEffect } from "react";
import { createPortal } from "react-dom";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScreenFreeze from "../ScreenFreeze";

// WHAT A FREEZE DOES TO CONTENT THAT LEFT THE SCREEN'S BOX.
//
// A screen that has to cover a shared bar cannot keep its overlay inside
// itself: a moving screen is a stacking context, and a stacking context cannot
// be interleaved with a sibling bar. So the overlay is portaled OUT of the
// screen — and the question this file settles is what it loses on the way.
//
// The intuition is that it loses the freeze, because `<Activity>` is a React
// thing and the overlay's DOM node is now somewhere else. That intuition is
// WRONG, and it is worth being wrong about in a test rather than on a device:
// React hides by walking the FIBER tree, and a portal's children are still in
// that subtree however far their DOM node travelled. Both halves of a freeze
// follow them — `display: none !important` on the portaled node, and the
// effect teardown.
//
// So a covered screen's overlay goes dark and goes quiet on its own. What it
// does NOT inherit is the OTHER half of being covered: `visibility: hidden` on
// the screen container (ScreenMotion) is plain CSS and only reaches the
// container's own DOM descendants. Those two are on different clocks — paint
// stops in the covering commit, the freeze is debounced on desktop Blink — so
// between them there is a window where a portaled overlay is the only thing
// left painting. Closing that window is the portaled content's own job, not
// React's.

vi.mock("@flemo/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flemo/core")>()),
  isDesktopBlink: () => false
}));

const cleanup = vi.fn();

function PortaledOverlay({ target }: { target: HTMLElement }) {
  useEffect(() => cleanup, []);

  return createPortal(<div data-overlay />, target);
}

const overlay = () => document.querySelector("[data-overlay]") as HTMLElement | null;
const inlineChild = () => document.querySelector("[data-inline]") as HTMLElement | null;

const released = (element: HTMLElement | null) =>
  element === null || element.style.display === "none" || element.closest("[hidden]") !== null;

describe("a freeze and content portaled out of the screen", () => {
  let host: HTMLDivElement;
  let elsewhere: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    cleanup.mockClear();
    host = document.createElement("div");
    // The portal target is a SIBLING of the screen, which is what an overlay
    // host is: outside the screen's box, so the screen's transform cannot
    // reach it and neither can anything else the screen writes on itself.
    elsewhere = document.createElement("div");
    document.body.append(host, elsewhere);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    elsewhere.remove();
    vi.useRealTimers();
  });

  const render = (freeze: boolean) =>
    act(() => {
      root.render(
        <ScreenFreeze freeze={freeze} mode="immediate">
          <div data-inline />
          <PortaledOverlay target={elsewhere} />
        </ScreenFreeze>
      );
    });

  it("releases the portaled node with the screen, not just the screen's own children", () => {
    render(false);
    expect(released(inlineChild())).toBe(false);
    expect(released(overlay())).toBe(false);

    render(true);
    act(() => vi.runAllTimers());

    expect(released(inlineChild())).toBe(true);
    // The one that could have gone either way. It did not: an overlay does not
    // outlive its screen's freeze, so nothing has to chase it down.
    expect(released(overlay())).toBe(true);
  });

  it("tears down effects the portaled content set up", () => {
    render(false);
    expect(cleanup).not.toHaveBeenCalled();

    render(true);
    act(() => vi.runAllTimers());

    // No half-dead overlay: an overlay that is still on the screen with its
    // escape key and its close timer already unmounted is not a state this
    // library can produce.
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
