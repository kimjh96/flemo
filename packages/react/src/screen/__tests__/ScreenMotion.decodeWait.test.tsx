import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type History, type TransitionName } from "@flemo/core";

import getScopeAnimHoldCoordinator from "@screen/scopeAnimHoldCoordinator";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// decodeWait wiring: the anim-hold coordinator must receive decodeWait TRUE only
// for a screen waking from a freeze (a pop destination / traversal reveal), and
// FALSE for a visible exit side or a fresh mount. That scoping is what keeps the
// (now universal) pair-gate free for push/replace: only wake-from-freeze screens
// pay the decode wait. These tests spy on the scope coordinator's `join` and read
// the `decodeWait` flag it received.

const historyEntry = (id: string): History => ({
  id,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName,
  layoutId: null
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
  layoutId: null,
  routePath: "/",
  ...overrides
});

describe("ScreenMotion decodeWait wiring", () => {
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

  const lastDecodeWait = (join: ReturnType<typeof vi.spyOn>) => {
    const calls = join.mock.calls;
    return (calls[calls.length - 1]?.[2] as { decodeWait?: boolean } | undefined)?.decodeWait;
  };

  it("a pop destination waking from a freeze joins with decodeWait true", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    // Rest: the covered screen below the top is frozen (COMPLETED, inactive) and
    // holds nothing yet.
    renderScreen(screenContext({ id: "below", isActive: false, isPrev: false, zIndex: 0 }));
    expect(join).not.toHaveBeenCalled();

    // Pop starts: index stays until COMPLETED, so this screen is the revealed
    // top's-prev. It was frozen in the previous commit → decodeWait true.
    await act(async () => {
      stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-1" });
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastDecodeWait(join)).toBe(true);
  });

  it("the exiting top of a pop joins with decodeWait false", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    // The visible active top was never frozen → nothing to re-decode.
    renderScreen(screenContext({ id: "top", isActive: true, isPrev: false, zIndex: 1 }));

    await act(async () => {
      stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-1" });
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastDecodeWait(join)).toBe(false);
  });

  it("a freshly mounted push entering screen joins with decodeWait false", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-1" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    await act(async () => {
      renderScreen(screenContext({ id: "top", isActive: true, isPrev: false, zIndex: 1 }));
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastDecodeWait(join)).toBe(false);
  });

  it("a replace exit side joins with decodeWait false", async () => {
    const join = vi.spyOn(getScopeAnimHoldCoordinator(stores.navigate), "join");
    stores.navigate.setState({ status: "REPLACING", transitionTaskId: "task-1" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    // The visible screen the replace animates out is not waking from a freeze.
    await act(async () => {
      renderScreen(screenContext({ id: "below", isActive: false, isPrev: false, zIndex: 0 }));
    });

    expect(join).toHaveBeenCalledTimes(1);
    expect(lastDecodeWait(join)).toBe(false);
  });
});
