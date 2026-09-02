import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type History, type TransitionName } from "@flemo/core";

// The settle gate is a PLATFORM decision (touch WebKit, touch Blink, steady-60
// desktop, desktop macOS Safari), and jsdom is none of them — without this the
// binding passes no `contentSettle` at all and there is no grace to read. Only
// that one field is overridden; every other profile value stays real.
vi.mock("@flemo/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@flemo/core")>();
  return {
    ...actual,
    resolvePlatformProfile: (...args: Parameters<typeof actual.resolvePlatformProfile>) => ({
      ...actual.resolvePlatformProfile(...args),
      renderSettleGate: true
    })
  };
});

import getScopeAnimHoldCoordinator from "@screen/scopeAnimHoldCoordinator";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// THE GRACE IS FOR MOUNT EFFECTS, AND ONLY A MOUNT HAS THEM.
//
// The settle gate's grace window exists to let a screen's mount effects issue
// their requests before the gate concludes the screen is warm: they run a tick
// after the paint the gate anchors to, so giving up sooner would call a loading
// screen idle. A screen that is NOT mounting has no such tick coming — a pop
// moves two screens that both existed before it — and waiting the window out
// there was 60ms of frozen flight on every pop, with nothing that could arrive
// in it. These tests read the `graceMs` the coordinator was joined with.
//
// What keeps the shorter grace honest is the raster guard in the gate itself: a
// give-up still has to ride two consecutive fast frames, so a screen whose
// unfreeze block has not run yet keeps waiting either way (covered in core's
// animStartAnchor tests).

const historyEntry = (id: string): History => ({
  id,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName
});

const screenContext = (overrides: Partial<ScreenContextProps>): ScreenContextProps => ({
  id: "screen",
  isActive: true,
  isRoot: false,
  isPrev: false,
  zIndex: 0,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName,
  prevTransitionName: "cupertino" as TransitionName,
  routePath: "/",
  ...overrides
});

describe("ScreenMotion settle grace wiring", () => {
  let stores: FlemoStores;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    stores = createTestStores();
    frames = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((frameCallback) => {
      frames.push(frameCallback);
      return frames.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderScreen = (screen: ScreenContextProps) =>
    render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider value={screen}>
          <ScreenMotion>
            <div>content</div>
          </ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

  const lastGrace = (join: ReturnType<typeof vi.spyOn>) => {
    const calls = join.mock.calls;
    const options = calls[calls.length - 1]?.[2] as
      { contentSettle?: { graceMs: number } } | undefined;
    return options?.contentSettle?.graceMs;
  };

  it("a freshly pushed screen keeps the grace — its mount effects are still to come", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-1" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    // Mounts already holding: it has never been at rest, so it is the mount the
    // window was written for.
    await act(async () => {
      renderScreen(screenContext({ id: "top", isActive: true, isPrev: false, zIndex: 1 }));
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastGrace(join)).toBe(60);
  });

  it("a pop's returning screen waits no grace — it was at rest a moment ago", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    // At rest first — this is the screen that has already lived a flight.
    renderScreen(screenContext({ id: "below", isActive: false, isPrev: false, zIndex: 0 }));
    expect(join).not.toHaveBeenCalled();

    await act(async () => {
      stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-1" });
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastGrace(join)).toBe(0);
  });

  it("the departing top of a pop waits no grace either — nothing mounts on a pop", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    renderScreen(screenContext({ id: "top", isActive: true, isPrev: false, zIndex: 1 }));

    await act(async () => {
      stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-1" });
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastGrace(join)).toBe(0);
  });

  it("the same screen keeps the grace on its mount and drops it once it has rested", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-1" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    // Mounted into its own push: the window is for exactly this.
    await act(async () => {
      renderScreen(screenContext({ id: "top", isActive: true, isPrev: false, zIndex: 1 }));
    });
    expect(lastGrace(join)).toBe(60);

    // That flight lands. From here the screen exists, so no mount effects can
    // still be owed — the grace is spent on nothing.
    await act(async () => {
      stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    });
    join.mockClear();

    await act(async () => {
      stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-2" });
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastGrace(join)).toBe(0);
  });
});
