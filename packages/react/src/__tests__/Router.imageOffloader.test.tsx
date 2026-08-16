import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Route from "@Route";

const dispose = vi.fn();
const ensure = vi.fn(() => dispose);
const legacy = vi.fn(() => false);

vi.mock("@flemo/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@flemo/core")>();
  return {
    ...actual,
    ensureImageDecodeOffloader: ensure,
    isLegacyAndroidBlink: () => legacy()
  };
});

const { default: Router } = await import("../Router");

beforeEach(() => {
  ensure.mockClear();
  dispose.mockClear();
  legacy.mockReturnValue(false);
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("Router image-decode offloader", () => {
  it("auto-mounts on legacy Android Blink and disposes with the Router", () => {
    legacy.mockReturnValue(true);
    const view = render(
      <Router>
        <Route path="/" element={<div>home</div>} />
      </Router>
    );

    expect(ensure).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();

    view.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("stays OFF on a modern engine (no UA-CH-brands signal, no flag)", () => {
    render(
      <Router>
        <Route path="/" element={<div>home</div>} />
      </Router>
    );

    expect(ensure).not.toHaveBeenCalled();
  });

  it("honors `flemo:imgoffload=on` as a manual override on any engine", () => {
    sessionStorage.setItem("flemo:imgoffload", "on");
    render(
      <Router>
        <Route path="/" element={<div>home</div>} />
      </Router>
    );

    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("lets `flemo:imgoffload=off` opt a legacy device back out", () => {
    legacy.mockReturnValue(true);
    sessionStorage.setItem("flemo:imgoffload", "off");
    render(
      <Router>
        <Route path="/" element={<div>home</div>} />
      </Router>
    );

    expect(ensure).not.toHaveBeenCalled();
  });

  it("lets each Router take its own refcounted hold", () => {
    legacy.mockReturnValue(true);
    const first = render(
      <Router>
        <Route path="/" element={<div>a</div>} />
      </Router>
    );
    const second = render(
      <Router>
        <Route path="/" element={<div>b</div>} />
      </Router>
    );

    // The module itself refcounts a single document-wide observer; every
    // Router must still take and drop its own hold.
    expect(ensure).toHaveBeenCalledTimes(2);

    first.unmount();
    second.unmount();

    expect(dispose).toHaveBeenCalledTimes(2);
  });
});

describe("interaction compositor pre-warm", () => {
  it("warms on interaction and releases after the tail", async () => {
    vi.useFakeTimers();
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = vi.fn(
      () => ({ cancel: vi.fn() }) as unknown as Animation
    ) as unknown as typeof Element.prototype.animate;
    try {
      render(
        <Router>
          <Route path="/" element={<div>home</div>} />
        </Router>
      );
      expect(document.querySelector("[data-flemo-warm]")).toBeNull();

      act(() => {
        document.dispatchEvent(new Event("pointerdown"));
      });
      expect(document.querySelector("[data-flemo-warm]")).not.toBeNull();

      // Later interaction inside the tail extends it (pointermove counts).
      act(() => {
        vi.advanceTimersByTime(2000);
        document.dispatchEvent(new Event("pointermove"));
      });
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(document.querySelector("[data-flemo-warm]")).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(document.querySelector("[data-flemo-warm]")).toBeNull();
    } finally {
      Element.prototype.animate = originalAnimate;
      vi.useRealTimers();
    }
  });
});
