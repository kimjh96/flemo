import { useContext } from "react";

import { render } from "@testing-library/react";
import { PresenceContext } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskManger } from "@flemo/core";

import { Route, Router } from "@flemo/react";

import LayoutScreen from "../LayoutScreen";

// Rendered through the real <Router>/<Route> pair (the only public way to
// provide the store + screen contexts LayoutScreen reads). Navigations park
// manual-gated tasks that animationend resolves at runtime; jsdom has no
// animations, so sweep the gate between tests like the @flemo/react suites do.
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
  window.history.replaceState(null, "", "/");
});
afterEach(async () => {
  await stopSweeper();
});

describe("LayoutScreen", () => {
  it("renders its children inside the flemo screen shell", () => {
    const { getByTestId } = render(
      <Router initPath="/">
        <Route
          path="/"
          element={
            <LayoutScreen>
              <div data-testid="content">home</div>
            </LayoutScreen>
          }
        />
      </Router>
    );

    const content = getByTestId("content");
    const shell = content.closest<HTMLElement>("[data-flemo-screen]");
    expect(shell).not.toBeNull();
    // The morph owns the paint: the screen shell defaults to transparent so
    // the shared element crossing screens is never covered.
    expect(shell!.style.backgroundColor).toBe("transparent");
  });

  it("wraps children in AnimatePresence so layoutId pairings survive exits", () => {
    let presence: unknown = "unread";
    function Probe() {
      presence = useContext(PresenceContext);
      return null;
    }

    render(
      <Router initPath="/">
        <Route
          path="/"
          element={
            <LayoutScreen>
              <Probe />
            </LayoutScreen>
          }
        />
      </Router>
    );

    // Outside an AnimatePresence the context is null; LayoutScreen's wrapper
    // provides one with the child marked present.
    expect(presence).not.toBeNull();
    expect((presence as { isPresent: boolean }).isPresent).toBe(true);
  });

  it("lets a consumer style override the transparent background default", () => {
    const { getByTestId } = render(
      <Router initPath="/">
        <Route
          path="/"
          element={
            <LayoutScreen style={{ backgroundColor: "red" }}>
              <div data-testid="content">home</div>
            </LayoutScreen>
          }
        />
      </Router>
    );

    const shell = getByTestId("content").closest<HTMLElement>("[data-flemo-screen]");
    expect(shell!.style.backgroundColor).toBe("red");
  });
});
