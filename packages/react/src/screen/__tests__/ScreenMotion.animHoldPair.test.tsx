import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNavigateStore, type History, type TransitionName } from "@flemo/core";

import getScopeAnimHoldCoordinator from "@screen/scopeAnimHoldCoordinator";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// The pop pair-release barrier through the React binding: both screens of one
// pop share the scope's anim-hold coordinator (keyed by the navigate store), so
// the exiting top must NOT drop its hold before the revealed screen's image
// decode finishes — the desync that made Cupertino's paired slide start on two
// clocks. These tests drive two real ScreenMotion instances and assert the
// `data-flemo-anim-hold` attributes flip to "false" in the SAME act() flush.

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

// A pop pair under one store bundle: the revealed screen beneath (inactive,
// zIndex 0) hosting an image, and the exiting top (active, zIndex 1) above it.
function PopPair({ stores }: { stores: FlemoStores }) {
  return (
    <StoreContext.Provider value={stores}>
      <ScreenContext.Provider
        value={screenContext({ id: "below", isActive: false, isPrev: true, zIndex: 0 })}
      >
        <ScreenMotion data-testid="below">
          <img data-testid="hero" alt="" />
        </ScreenMotion>
      </ScreenContext.Provider>
      <ScreenContext.Provider value={screenContext({ id: "top", isActive: true, zIndex: 1 })}>
        <ScreenMotion data-testid="top">
          <div>top</div>
        </ScreenMotion>
      </ScreenContext.Provider>
    </StoreContext.Provider>
  );
}

describe("ScreenMotion pop pair release", () => {
  let stores: FlemoStores;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    stores = createTestStores();
    stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-1" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });
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

  const flushFrames = async (time: number) => {
    await act(async () => {
      frames.splice(0).forEach((frameCallback) => frameCallback(time));
    });
  };

  const flushMicrotasks = async () => {
    await act(async () => {
      for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    });
  };

  // Make the revealed screen's image decode controllable: loaded (so the hold's
  // decode wait picks it up) but resolving only when the test says so — the
  // image-heavy list whose discarded bitmaps re-decode during the hold.
  const stallDecode = (image: HTMLImageElement) => {
    let resolveDecode!: () => void;
    Object.defineProperty(image, "complete", { value: true, configurable: true });
    image.decode = () => new Promise<void>((resolve) => (resolveDecode = resolve));
    return () => resolveDecode();
  };

  it("keeps the exiting top held until the revealed screen's decode, then flips both in one flush", async () => {
    const { getByTestId } = render(<PopPair stores={stores} />);
    const below = getByTestId("below");
    const top = getByTestId("top");
    const resolveDecode = stallDecode(getByTestId("hero") as HTMLImageElement);

    expect(top.getAttribute("data-flemo-anim-hold")).toBe("true");
    expect(below.getAttribute("data-flemo-anim-hold")).not.toBe("false");

    // Two frames: the paint anchor elapses for BOTH screens. The top (no
    // images) is now ready — before the pair barrier it released right here,
    // ~100ms before its partner. It must keep holding for the revealed
    // screen's in-flight decode.
    await flushFrames(0);
    await flushFrames(16);
    await flushMicrotasks();
    expect(top.getAttribute("data-flemo-anim-hold")).not.toBe("false");
    expect(below.getAttribute("data-flemo-anim-hold")).not.toBe("false");

    // The decode settles → the whole pair releases in the SAME act flush.
    await act(async () => {
      resolveDecode();
      for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    });
    expect(top.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(below.getAttribute("data-flemo-anim-hold")).toBe("false");
  });

  it("re-arms and pair-releases again on the next pop (fresh group per transition task)", async () => {
    const { getByTestId } = render(<PopPair stores={stores} />);
    const below = getByTestId("below");
    const top = getByTestId("top");
    const resolveDecode = stallDecode(getByTestId("hero") as HTMLImageElement);

    // Pop #1 releases as a pair.
    await flushFrames(0);
    await flushFrames(16);
    await act(async () => {
      resolveDecode();
      for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    });
    expect(top.getAttribute("data-flemo-anim-hold")).toBe("false");

    // Settle, then a second pop with a new task id re-arms the hold.
    await act(async () => {
      stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    });
    await act(async () => {
      stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-2" });
    });
    expect(top.getAttribute("data-flemo-anim-hold")).toBe("true");
    expect(below.getAttribute("data-flemo-anim-hold")).not.toBe("false");

    // The fresh group gates on the fresh decode, with no leakage from pop #1.
    await flushFrames(32);
    await flushFrames(48);
    await flushMicrotasks();
    expect(top.getAttribute("data-flemo-anim-hold")).not.toBe("false");

    await act(async () => {
      resolveDecode();
      for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    });
    expect(top.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(below.getAttribute("data-flemo-anim-hold")).toBe("false");
  });

  it("swallows a backstop firing after the hold already released (idempotent release contract)", async () => {
    // The lone-screen path (scheduleAnimHoldRelease) keeps its backstop armed
    // until the effect cleanup; a backstop firing right after the readiness
    // release must be a no-op on the already-released hold state.
    const timeouts: (() => void)[] = [];
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
      timeouts.push(callback);
      return 0;
    }) as never);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });

    const { getByTestId } = render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider value={screenContext({ id: "top", isActive: true, zIndex: 1 })}>
          <ScreenMotion data-testid="pushing">
            <div>no images</div>
          </ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

    await flushFrames(0);
    // Readiness release and the (stale) backstop release land in the SAME
    // batch: the second updater must observe `released: true` and bail.
    await act(async () => {
      frames.splice(0).forEach((frameCallback) => frameCallback(16));
      timeouts.splice(0).forEach((timeoutCallback) => timeoutCallback());
    });
    expect(getByTestId("pushing").getAttribute("data-flemo-anim-hold")).toBe("false");
  });

  it("never couples two Router scopes: a sibling scope's pop releases on its own clock", async () => {
    // Two scopes popping simultaneously with IDENTICAL group keys (same status,
    // transition, and task id) — isolation must come from the per-scope
    // coordinator, not from key luck.
    const otherStores = createTestStores();
    otherStores.navigate.setState({ status: "POPPING", transitionTaskId: "task-1" });
    otherStores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("top")]
    });

    const { getByTestId } = render(
      <>
        <StoreContext.Provider value={stores}>
          <ScreenContext.Provider value={screenContext({ id: "top", isActive: true, zIndex: 1 })}>
            <ScreenMotion data-testid="slow-scope">
              <img data-testid="slow-hero" alt="" />
            </ScreenMotion>
          </ScreenContext.Provider>
        </StoreContext.Provider>
        <StoreContext.Provider value={otherStores}>
          <ScreenContext.Provider value={screenContext({ id: "top", isActive: true, zIndex: 1 })}>
            <ScreenMotion data-testid="fast-scope">
              <div>no images</div>
            </ScreenMotion>
          </ScreenContext.Provider>
        </StoreContext.Provider>
      </>
    );
    stallDecode(getByTestId("slow-hero") as HTMLImageElement);

    await flushFrames(0);
    await flushFrames(16);
    await flushMicrotasks();

    // The fast scope released at its own readiness; the slow scope's pending
    // decode holds only its own screen.
    expect(getByTestId("fast-scope").getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(getByTestId("slow-scope").getAttribute("data-flemo-anim-hold")).not.toBe("false");
  });
});

describe("getScopeAnimHoldCoordinator", () => {
  it("returns one stable coordinator per navigate store, and distinct ones across stores", () => {
    const storeA = createNavigateStore();
    const storeB = createNavigateStore();

    const coordinatorA = getScopeAnimHoldCoordinator(storeA);
    expect(getScopeAnimHoldCoordinator(storeA)).toBe(coordinatorA);
    expect(getScopeAnimHoldCoordinator(storeB)).not.toBe(coordinatorA);
  });
});
