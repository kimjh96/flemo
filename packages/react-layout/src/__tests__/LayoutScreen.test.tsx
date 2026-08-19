import { useContext } from "react";

import { act, render } from "@testing-library/react";
import { PresenceContext } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskManger } from "@flemo/core";

import { Route, Router, useNavigate } from "@flemo/react";

import LayoutScreen from "../LayoutScreen";

// Route paths are typed by consumer interface augmentation; register the two
// this file navigates between so `push` is typed rather than cast.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/": "/";
    "/next": "/next";
  }
}

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

// The freeze predicate is core's, not this package's. LayoutScreen used to
// hand-roll it and quietly missed two rounds of fixes; this pins the
// delegation so a fork cannot come back unnoticed.
describe("LayoutScreen freeze delegation", () => {
  it("composes Screen, so the covered screen keeps core's deferred freeze", async () => {
    const { getByTestId, getByRole } = render(
      <Router initPath="/">
        <Route
          path="/"
          element={
            <LayoutScreen>
              <div data-testid="home">home</div>
              <PushButton />
            </LayoutScreen>
          }
        />
        <Route
          path="/next"
          element={
            <LayoutScreen>
              <div data-testid="next">next</div>
            </LayoutScreen>
          }
        />
      </Router>
    );

    act(() => {
      getByRole("button").click();
    });
    await act(async () => {
      await TaskManger.resolveAllPending();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    // The just-covered screen must still be live right after the flight: core
    // defers its freeze past the convergence (FREEZE_DEFER_MS), which is
    // exactly the behavior the forked predicate never had.
    const covered = getByTestId("home").closest<HTMLElement>("[data-flemo-screen]");
    expect(covered).not.toBeNull();
    expect(covered!.getAttribute("data-flemo-status")).toBe("COMPLETED");
    // Activity's hidden mode keeps the DOM and hides the CONTAINER, so the
    // freeze shows up on the parent's display — the screen element itself
    // looks identical either way. The forked predicate froze here in the
    // COMPLETED commit; core defers it past the convergence.
    const container = covered!.parentElement as HTMLElement | null;
    expect(container).not.toBeNull();
    expect(container!.style.display).not.toBe("none");
  });
});

function PushButton() {
  const { push } = useNavigate();
  return (
    <button type="button" onClick={() => push("/next")}>
      go
    </button>
  );
}

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
