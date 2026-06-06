import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Route from "@Route";
import Router from "@Router";

import RouterScopeProvider from "@stores/RouterScopeProvider";
import useHistoryStore from "@stores/useHistoryStore";
import useStores from "@stores/useStores";

// Reads the hosted stores from OUTSIDE the Router — the case that crashed when the inspector
// panel sat beside the frame: without a host provider, useStores() throws.
function Probe() {
  const depth = useHistoryStore((state) => state.histories.length);
  const rootPathname = useHistoryStore((state) => state.histories[0]?.pathname ?? "");
  return <div data-testid="probe" data-depth={depth} data-root={rootPathname} />;
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
