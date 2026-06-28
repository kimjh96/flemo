import { useEffect } from "react";

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useNavigate from "@navigate/useNavigate";

import Screen from "@screen/Screen";

import Route from "@Route";

import Router from "../Router";
import RouterDepthContext from "../RouterDepthContext";

// A root <Router> renders full-viewport screens (no region wrapper); a <Router>
// nested inside another (depth > 0) becomes a transition region: it wraps its
// screens in a positioned, clipped box and contains them to it.

describe("Router", () => {
  it("root: anchors screens to the viewport with no region wrapper", () => {
    const { container, getByTestId } = render(
      <Router initPath="/">
        <Route
          path="/"
          element={
            <Screen>
              <div data-testid="home">home</div>
            </Screen>
          }
        />
      </Router>
    );

    const screenContainer = container.querySelector<HTMLElement>('div[style*="contain"]');
    expect(screenContainer).not.toBeNull();
    expect(screenContainer!.style.position).toBe("fixed");
    expect(getByTestId("home")).toBeDefined();
  });

  it("nested: wraps screens in a relative, clipped region box and contains them", () => {
    const { container, getByTestId } = render(
      <RouterDepthContext.Provider value={1}>
        <Router initPath="/" className="region">
          <Route
            path="/"
            element={
              <Screen>
                <div data-testid="home">home</div>
              </Screen>
            }
          />
        </Router>
      </RouterDepthContext.Provider>
    );

    const region = container.querySelector<HTMLElement>(".region");
    expect(region).not.toBeNull();
    expect(region!.style.position).toBe("relative");
    expect(region!.style.overflow).toBe("hidden");

    const screenContainer = container.querySelector<HTMLElement>('div[style*="contain"]');
    expect(screenContainer!.style.position).toBe("absolute");
    expect(getByTestId("home")).toBeDefined();
  });

  it("nested: navigates in its local stack without touching the browser history", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    function Home() {
      const navigate = useNavigate();
      useEffect(() => {
        (navigate.push as (path: string) => void)("/next");
      }, [navigate]);
      return (
        <Screen>
          <div data-testid="home">home</div>
        </Screen>
      );
    }

    const { findByTestId } = render(
      <RouterDepthContext.Provider value={1}>
        <Router initPath="/">
          <Route path="/" element={<Home />} />
          <Route
            path="/next"
            element={
              <Screen>
                <div data-testid="next">next</div>
              </Screen>
            }
          />
        </Router>
      </RouterDepthContext.Provider>
    );

    // The entering screen mounts (the nested region navigated)...
    await findByTestId("next");
    // ...via the in-memory driver, so the browser history was never touched.
    expect(pushStateSpy).not.toHaveBeenCalled();

    pushStateSpy.mockRestore();
  });
});
