import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { History, TransitionName } from "@flemo/core";

import Part from "@screen/Part";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

import RouterIdContext from "../../RouterIdContext";

// A <Part> mounted OUTSIDE any screen — the position <Part> documents as
// supported ("a persistent header next to a <Slot>, a portal") — is driven by
// this flight's compiled keyframes, because the part selector keys on name +
// status + active with no structural term. Nothing paused it: the compiled
// hold rule reaches a held element's DESCENDANTS, and this part is a
// descendant of no screen and no shared bar. It ran through the whole hold
// window with every screen parked, then led the flight by the hold's length.
//
// This is the REAL structure (Part outside, screens inside the Slot's box).
// The engine-level unit test cannot stand in for it: an outer part synthesized
// as a sibling of the screen scope sits where the React binding puts SHARED
// BARS, and those already carry `data-flemo-anim-hold` from the binding — a
// container-scoped collection passes there while finding nothing real.

const historyEntry = (id: string): History => ({
  id,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName,
  layoutId: null
});

const screenContext = (overrides: Partial<ScreenContextProps>): ScreenContextProps => ({
  id: "entering",
  isActive: true,
  isRoot: false,
  isPrev: false,
  zIndex: 1,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName,
  prevTransitionName: "cupertino" as TransitionName,
  layoutId: null,
  routePath: "/",
  ...overrides
});

// <Router id="router-1"> persistent <Part> + <Slot><ScreenMotion/></Slot>.
function PersistentChrome({ stores }: { stores: FlemoStores }) {
  return (
    <StoreContext.Provider value={stores}>
      <RouterIdContext.Provider value="router-1">
        <Part name={"header" as never} data-testid="outer-part" />
        <div data-testid="slot" style={{ position: "relative", overflow: "hidden" }}>
          <ScreenContext.Provider value={screenContext({})}>
            <ScreenMotion data-testid="screen">
              <Part name={"title" as never} data-testid="inner-part" />
            </ScreenMotion>
          </ScreenContext.Provider>
        </div>
      </RouterIdContext.Provider>
    </StoreContext.Provider>
  );
}

const HOLD = "data-flemo-anim-hold";

describe("outer <Part> hold mirroring (real Router/Part/Slot structure)", () => {
  let stores: FlemoStores;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    stores = createTestStores();
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-1" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("root"), historyEntry("entering")]
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

  it("holds a <Part> that lives outside the Slot for the hold window", async () => {
    const { getByTestId } = render(<PersistentChrome stores={stores} />);
    const outer = getByTestId("outer-part");
    const screen = getByTestId("screen");

    // MID-FLIGHT is the only discriminating moment: after the release both
    // the fixed and the broken engine leave the part unpaused.
    expect(screen.getAttribute(HOLD)).not.toBe("false");
    expect(outer.getAttribute(HOLD), "the outer part must ride the flight's hold").toBe("true");
  });

  it("releases the outer part when the flight's hold releases", async () => {
    const { getByTestId } = render(<PersistentChrome stores={stores} />);
    const outer = getByTestId("outer-part");
    const screen = getByTestId("screen");

    await flushFrames(0);
    await flushFrames(16);
    await flushMicrotasks();

    expect(screen.getAttribute(HOLD)).toBe("false");
    expect(outer.getAttribute(HOLD), "the pause must not outlive the flight").toBeNull();
  });

  it("leaves a <Part> inside the screen alone — the screen's own hold covers it", async () => {
    const { getByTestId } = render(<PersistentChrome stores={stores} />);

    // The compiled rule pauses `[data-flemo-anim-hold=…] [data-flemo-part-name]`,
    // so stamping it again would be redundant state to clean up.
    expect(getByTestId("inner-part").getAttribute(HOLD)).toBeNull();
  });

  it("ignores a <Part> owned by a different Router", async () => {
    const otherStores = createTestStores();
    otherStores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-2" });
    const { getByTestId } = render(
      <>
        <PersistentChrome stores={stores} />
        <StoreContext.Provider value={otherStores}>
          <RouterIdContext.Provider value="router-2">
            <Part name={"header" as never} data-testid="foreign-part" />
          </RouterIdContext.Provider>
        </StoreContext.Provider>
      </>
    );

    expect(getByTestId("outer-part").getAttribute(HOLD)).toBe("true");
    expect(
      getByTestId("foreign-part").getAttribute(HOLD),
      "another Router's chrome is not this flight's participant"
    ).toBeNull();
  });
});
