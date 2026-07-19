import { type ReactNode } from "react";

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTransition,
  registerTransitionDefinitions,
  type History,
  type TransitionName
} from "@flemo/core";

import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// Learned content deferral: a route whose full-content mount previously froze
// the tap (measured past the threshold) enters as a shell — children render
// inside a hidden <Activity> and reveal at rest. Learning itself only commits
// once the entry's transition COMPLETED: an interrupted flight must not
// persist a half-story, and a harness where transitions never run must never
// learn from its meaningless mount timings.

const TAB = "deferral-tab" as TransitionName;
const HEAVY_ROUTE = "/heavy-route";
const STORAGE_KEY = "flemo:mount-cost";

const entry = (id: string): History => ({
  id,
  pathname: HEAVY_ROUTE,
  params: {},
  transitionName: TAB,
  layoutId: null
});

const ctx = (o: Partial<ScreenContextProps>): ScreenContextProps => ({
  id: "s",
  isActive: true,
  isRoot: false,
  isPrev: false,
  zIndex: 0,
  pathname: HEAVY_ROUTE,
  params: {},
  transitionName: TAB,
  prevTransitionName: TAB,
  layoutId: null,
  routePath: HEAVY_ROUTE,
  ...o
});

describe("ScreenMotion learned content deferral", () => {
  let stores: FlemoStores;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    registerTransitionDefinitions(
      [
        createTransition({
          name: TAB as never,
          initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
          idle: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0 } },
          enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.15 } },
          enterBack: { value: { x: "100%" }, options: { duration: 0.15 } },
          exit: { value: { x: "-1%", clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.15 } },
          exitBack: { value: { x: 0 }, options: { duration: 0.15 } }
        })
      ],
      []
    );
    stores = createTestStores();
    stores.navigate.setState({ status: "REPLACING", transitionTaskId: "task-deferral" });
    stores.history.setState({ index: 1, histories: [entry("leftover"), entry("entering")] });
    frames = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.restoreAllMocks();
  });

  const renderEntering = (children: ReactNode) =>
    render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider value={ctx({ id: "entering", isActive: true, zIndex: 1 })}>
          <ScreenMotion data-testid="enter">{children}</ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

  const flushFrames = () => {
    // Drain every scheduled frame, including ones a frame schedules.
    for (let hop = 0; hop < 6; hop++) {
      const batch = frames.splice(0);
      batch.forEach((cb) => cb(performance.now()));
    }
  };

  it("a learned-heavy route enters as a shell and reveals two frames past COMPLETED", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ [HEAVY_ROUTE]: { ms: 380, at: Date.now() } })
    );
    const { getByTestId } = renderEntering(<div data-testid="content">heavy content</div>);

    // In flight: the content is mounted at background priority but hidden —
    // the entering commit carries only the shell.
    expect(getByTestId("content").style.display).toBe("none");

    act(() => {
      stores.navigate.setState({ status: "COMPLETED" });
    });
    // Still hidden at the COMPLETED flip itself (the convergence commit)...
    expect(getByTestId("content").style.display).toBe("none");
    // ...and revealed two frames later, at rest.
    act(() => flushFrames());
    expect(getByTestId("content").style.display).not.toBe("none");
  });

  it("records the mount block only once the transition COMPLETED", () => {
    renderEntering(<div data-testid="content">light content</div>);

    // Mounted mid-flight: measured, but nothing persisted yet.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      stores.navigate.setState({ status: "COMPLETED" });
    });
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<
      string,
      { ms: number }
    >;
    expect(typeof persisted[HEAVY_ROUTE]?.ms).toBe("number");
  });

  it("the liveness backstop reveals content even if the flight never lands", () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ [HEAVY_ROUTE]: { ms: 380, at: Date.now() } })
      );
      const { getByTestId } = renderEntering(<div data-testid="content">heavy content</div>);
      expect(getByTestId("content").style.display).toBe("none");

      act(() => {
        vi.advanceTimersByTime(3001);
      });
      expect(getByTestId("content").style.display).not.toBe("none");
    } finally {
      vi.useRealTimers();
    }
  });
});
