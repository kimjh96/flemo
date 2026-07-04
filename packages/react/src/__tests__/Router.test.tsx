import { useEffect } from "react";

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskManger } from "@flemo/core";

import useNavigate from "@navigate/useNavigate";

import Screen from "@screen/Screen";

import ScreenContext from "@screen/ScreenContext";

import Route from "@Route";
import useStores from "@stores/useStores";

import Router from "../Router";
import RouterDepthContext from "../RouterDepthContext";
import Slot from "../Slot";

// Each navigation parks a manual-gated task that ScreenMotion resolves from
// `animationend` at runtime. jsdom has no animation, so sweep the manual gate so
// each push completes and releases the shared task lock for the next test.
const startManualGateSweeper = () => {
  let sweeping = true;
  const sweeper = (async () => {
    while (sweeping) {
      await new Promise((resolve) => setTimeout(resolve, 8));
      await TaskManger.resolveAllPending();
    }
  })();
  return async () => {
    sweeping = false;
    await sweeper;
  };
};

let stopSweeper: () => Promise<void>;
beforeEach(() => {
  stopSweeper = startManualGateSweeper();
});
afterEach(async () => {
  await stopSweeper();
});

// A root <Router> renders full-viewport screens (no region wrapper); a <Router>
// nested inside another (depth > 0) becomes a transition region: it wraps its
// screens in a positioned, clipped box and contains them to it.

describe("nested Router key stability", () => {
  // The browser driver's state key must survive a remount: a re-pushed screen
  // restores the same history-entry id, and the reborn nested Router must read
  // the frames its previous incarnation wrote. useId regenerates per mount and
  // orphaned them (the rapid back/forward "URL changes but the screen doesn't").
  const screenValue = {
    id: "entry-abc",
    isActive: true,
    isRoot: false,
    isPrev: false,
    zIndex: 1,
    pathname: "/host",
    params: {},
    transitionName: "cupertino" as const,
    prevTransitionName: "cupertino" as const,
    layoutId: null,
    routePath: "/host"
  };

  const captureKey = () => {
    const keys: (string | undefined)[] = [];
    const createDriver = (key?: string) => {
      keys.push(key);
      // A minimal in-memory HistoryDriver double.
      return {
        readPathname: () => "/nested",
        readState: () => null,
        pushState: () => {},
        replaceState: () => {},
        go: () => {},
        back: () => {},
        subscribe: () => () => {}
      };
    };
    const ui = (
      <ScreenContext.Provider value={screenValue}>
        <RouterDepthContext.Provider value={1}>
          <Router initPath="/nested" createDriver={createDriver}>
            <Route path="/nested" element={<div>panel</div>} />
          </Router>
        </RouterDepthContext.Provider>
      </ScreenContext.Provider>
    );
    return { keys, ui };
  };

  it("derives the same key across remounts from the enclosing screen's entry id", () => {
    const { keys, ui } = captureKey();
    const first = render(ui);
    first.unmount();
    render(ui);

    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys[0]).toBe("_F_entry-abc_");
    expect(keys[keys.length - 1]).toBe("_F_entry-abc_");
  });
});

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

  it('nested history="memory": navigates in its local stack without touching the browser history', async () => {
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
        <Router initPath="/" history="memory">
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

  it('nested history="browser" (default): push writes window.history, then a browser back pops its own stack', async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    let stores: ReturnType<typeof useStores> | null = null;

    function Home() {
      stores = useStores();
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

    // A nested browser Router participates in window.history: the push wrote it
    // and the local stack advanced to index 1.
    await findByTestId("next");
    expect(pushStateSpy).toHaveBeenCalled();
    expect(stores!.history.getState().index).toBe(1);

    // A genuine browser back pops the nested Router within its own keyed stack:
    // its HistoryListener resolves the popstate down to index 0.
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    await waitFor(() => expect(stores!.history.getState().index).toBe(0));

    pushStateSpy.mockRestore();
  });

  it("Slot: routes render in the contained region; outside-Slot chrome persists and drives it", async () => {
    function Sidebar() {
      const navigate = useNavigate();
      return (
        <button
          type="button"
          data-testid="to-library"
          onClick={() => (navigate.push as (path: string) => void)("/library")}
        >
          library
        </button>
      );
    }

    const { getByTestId, findByTestId } = render(
      <Router initPath="/">
        <div>
          <Sidebar />
          <Slot className="region">
            <Route
              path="/"
              element={
                <Screen>
                  <div data-testid="home">home</div>
                </Screen>
              }
            />
            <Route
              path="/library"
              element={
                <Screen>
                  <div data-testid="library">library</div>
                </Screen>
              }
            />
          </Slot>
        </div>
      </Router>
    );

    // The route renders inside the Slot's contained region (absolute), and the
    // region box is the positioned ancestor.
    const region = document.querySelector<HTMLElement>(".region");
    expect(region!.style.position).toBe("relative");
    const screenContainer = region!.querySelector<HTMLElement>('div[style*="contain"]');
    expect(screenContainer!.style.position).toBe("absolute");
    expect(getByTestId("home")).toBeDefined();

    // The sidebar lives OUTSIDE the Slot, yet its plain useNavigate drives the
    // region — one Router, one history, no cross-boundary wiring.
    const sidebarButton = getByTestId("to-library");
    fireEvent.click(sidebarButton);

    await findByTestId("library");
    // The chrome persisted across the region's navigation (same DOM node).
    expect(getByTestId("to-library")).toBe(sidebarButton);
  });
});
