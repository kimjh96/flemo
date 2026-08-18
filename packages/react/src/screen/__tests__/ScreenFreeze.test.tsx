import { act } from "react";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScreenFreeze from "../ScreenFreeze";

// The freeze debounce (see ScreenFreeze): on steady-60 desktops the hide of a
// covered screen waits FREEZE_REST_DEBOUNCE_MS so a quick detail-and-back
// round trip never pays Activity's hide/unhide raster thrash; everywhere else
// the freeze applies immediately (the shipped behavior). Unfreeze is always
// same-commit.

let sixtyEligible = false;
vi.mock("@flemo/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flemo/core")>()),
  steadySixtyPlayerEligible: () => sixtyEligible
}));

const probe = () => document.querySelector("[data-probe]") as HTMLElement | null;
const isHidden = () => {
  const el = probe();
  return el === null || el.style.display === "none" || el.closest("[hidden]") !== null;
};

describe("ScreenFreeze debounce", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    sixtyEligible = false;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  const render = (freeze: boolean) =>
    act(() => {
      root.render(
        <ScreenFreeze freeze={freeze}>
          <div data-probe>content</div>
        </ScreenFreeze>
      );
    });

  it("freezes immediately when the session is not steady-60", () => {
    render(false);
    render(true);
    act(() => vi.advanceTimersByTime(0));
    expect(isHidden()).toBe(true);
  });

  it("debounces the hide on steady-60 desktops and cancels on a quick return", () => {
    sixtyEligible = true;
    render(false);
    render(true);
    // Inside the browse-rhythm window: still live.
    act(() => vi.advanceTimersByTime(1000));
    expect(isHidden()).toBe(false);
    // Quick pop back: never froze, nothing to unhide.
    render(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(isHidden()).toBe(false);
  });

  it("still freezes after a genuine stay on steady-60 desktops", () => {
    sixtyEligible = true;
    render(false);
    render(true);
    act(() => vi.advanceTimersByTime(4000));
    expect(isHidden()).toBe(true);
    // Unfreeze is same-commit.
    render(false);
    expect(isHidden()).toBe(false);
  });
});
