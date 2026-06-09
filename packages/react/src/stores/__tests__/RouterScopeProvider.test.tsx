import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Route from "@Route";
import Router from "@Router";

import RouterScopeProvider from "@stores/RouterScopeProvider";
import useHistoryStore from "@stores/useHistoryStore";
import useNavigateStore from "@stores/useNavigateStore";
import useScreenStore from "@stores/useScreenStore";
import useStores from "@stores/useStores";

// Reads the hosted stores from OUTSIDE the Router, the case that crashed when the inspector
// panel sat beside the frame: without a host provider, useStores() throws. Exercises every
// selector hook so each resolves the same hosted bundle.
function Probe() {
  const depth = useHistoryStore((state) => state.histories.length);
  const rootPathname = useHistoryStore((state) => state.histories[0]?.pathname ?? "");
  const status = useNavigateStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  return (
    <div
      data-testid="probe"
      data-depth={depth}
      data-root={rootPathname}
      data-status={status}
      data-drag={dragStatus}
    />
  );
}

function adopts() {
  let adopted: ReturnType<typeof useStores> | null = null;
  function Capture() {
    adopted = useStores();
    return null;
  }
  return { get: () => adopted, Capture };
}

describe("RouterScopeProvider", () => {
  it("lets a sibling outside the Router read the bundle the Router seeded", () => {
    const { getByTestId } = render(
      <RouterScopeProvider>
        <Router>
          <Route path="/" element={<div>root</div>} />
        </Router>
        <Probe />
      </RouterScopeProvider>
    );

    const probe = getByTestId("probe");
    // The Router seeded the hosted history with the root frame; the external probe sees it.
    expect(probe.getAttribute("data-depth")).toBe("1");
    expect(probe.getAttribute("data-root")).toBe("/");
    // The navigate/screen selector hooks resolve the same bundle and read its initial state.
    expect(probe.getAttribute("data-status")).toBe("IDLE");
    expect(probe.getAttribute("data-drag")).toBe("IDLE");
  });

  it("throws when a store hook is used with no Router or scope above it", () => {
    function Bare() {
      useStores();
      return null;
    }

    // Silence React's expected error log for the throwing render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/render inside a <Router>/i);
    spy.mockRestore();
  });

  it("the Router adopts the hosted bundle instead of creating its own", () => {
    const outside = adopts();
    let inside: ReturnType<typeof useStores> | null = null;

    function Inside() {
      inside = useStores();
      return null;
    }

    render(
      <RouterScopeProvider>
        <outside.Capture />
        <Router>
          <Route path="/" element={<Inside />} />
        </Router>
      </RouterScopeProvider>
    );

    // Same history store instance on both sides of the Router boundary.
    expect(inside).not.toBeNull();
    expect(inside!.history).toBe(outside.get()!.history);
  });
});
