import { act } from "react";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScreenFreeze from "../ScreenFreeze";

// A freeze is TWO things on two clocks (see ScreenFreeze): the screen stops
// PAINTING, and the screen is RELEASED (effects unmounted, boxes dropped,
// raster let go). Only the second is expensive, and only the second is what
// the debounce below is about.
//
// So the pair is pinned separately here. Paint stops in the same commit, on
// every platform — that is what a covered screen not being visible means, and
// it used to wait on the release, which on a desktop is three seconds of a
// stack painting through itself. The release keeps its clock: on DESKTOP BLINK
// a screen a pop could come back to waits FREEZE_REST_DEBOUNCE_MS, so a quick
// detail-and-back never pays Activity's hide/unhide thrash. A DEEP screen is
// never what a pop wakes, so it is released at once everywhere.
//
// The gate was the steady-60 verdict until 2026-08-21: the debounce trades
// memory for raster, which is an argument about the machine, not about its
// refresh rate.

let desktopBlink = false;
vi.mock("@flemo/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flemo/core")>()),
  isDesktopBlink: () => desktopBlink
}));

// The wrapper ScreenFreeze renders: it carries the paint state itself, and
// React's <Activity> writes the release onto it.
const probe = () => document.querySelector("[data-probe]") as HTMLElement | null;
const isReleased = () => {
  const el = probe();
  return el === null || el.style.display === "none" || el.closest("[hidden]") !== null;
};

describe("ScreenFreeze debounce", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    desktopBlink = false;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  const render = (freeze: boolean, mode: "deferred" | "immediate" = "deferred") =>
    act(() => {
      root.render(
        <ScreenFreeze freeze={freeze} mode={mode}>
          <div data-probe>content</div>
        </ScreenFreeze>
      );
    });

  it("freezes immediately off desktop Blink", () => {
    render(false);
    render(true);
    act(() => vi.advanceTimersByTime(0));
    expect(isReleased()).toBe(true);
  });

  it("releases a DEEP screen at once, on every platform", () => {
    // Only the just-covered screen can be what a pop comes back to, so only
    // its release can be the one a pop has to undo. Waiting buys a deep screen
    // nothing — and a rapid push storm never offers the quiet window the wait
    // is looking for, so the live screens pile up instead.
    desktopBlink = true;
    render(false);
    render(true, "immediate");
    act(() => vi.advanceTimersByTime(0));
    expect(isReleased()).toBe(true);
  });

  it("debounces the release on desktop Blink and cancels on a quick return", () => {
    desktopBlink = true;
    render(false);
    render(true);
    // Inside the browse-rhythm window: not released, so the pop pays nothing.
    act(() => vi.advanceTimersByTime(1000));
    expect(isReleased()).toBe(false);
    render(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(isReleased()).toBe(false);
  });

  it("still releases after a genuine stay on desktop Blink", () => {
    desktopBlink = true;
    render(false);
    render(true);
    act(() => vi.advanceTimersByTime(4000));
    expect(isReleased()).toBe(true);
    // Waking is same-commit.
    render(false);
    expect(isReleased()).toBe(false);
  });
});
