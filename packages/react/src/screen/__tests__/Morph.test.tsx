import { type PropsWithChildren } from "react";

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useStore } from "zustand";

import Morph from "@screen/Morph";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// The component itself is twenty lines; what is worth pinning is that it keeps
// the runtime's CONTRACT — registered before paint, re-registered on every
// status change — because everything a morph does depends on those two moments.

let stores: FlemoStores;

// jsdom lays nothing out and a morph is nothing but rects, so the boxes are
// stated here and served by test id.
const RECTS: Record<string, [number, number, number, number]> = {
  thumb: [20, 600, 80, 80],
  hero: [0, 0, 400, 300]
};

beforeEach(() => {
  stores = createTestStores();
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const id = this.getAttribute("data-testid");
    const [x, y, width, height] = (id && RECTS[id]) || [0, 0, 400, 800];
    return {
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({})
    } as DOMRect;
  };
});

const base: ScreenContextProps = {
  id: "screen-1",
  isActive: true,
  isRoot: false,
  isPrev: false,
  zIndex: 0,
  pathname: "/photos",
  params: {},
  transitionName: "layout",
  prevTransitionName: "layout",
  routePath: "/photos"
};

function ScreenShell({ isActive, children }: PropsWithChildren<{ isActive: boolean }>) {
  // The real Screen renders the LIVE status, and the morph runtime reads it to
  // tell a screen that is in this flight from one that is merely stacked
  // underneath. A shell pinned at IDLE would let this suite pass on a runtime
  // that pairs across screens which are not transitioning at all.
  const status = useStore(stores.navigate, (state) => state.status);
  return (
    <ScreenContext.Provider value={{ ...base, isActive }}>
      <div
        data-flemo-screen=""
        data-flemo-transition="layout"
        data-flemo-status={status}
        data-flemo-active={isActive ? "true" : "false"}
      >
        {children}
      </div>
    </ScreenContext.Provider>
  );
}

function Scene({ pushed }: { pushed: boolean }) {
  return (
    <StoreContext.Provider value={stores}>
      <ScreenShell isActive={!pushed}>
        <Morph layoutId="photo-1" data-testid="thumb" />
      </ScreenShell>
      {pushed ? (
        <ScreenShell isActive>
          <Morph layoutId="photo-1" data-testid="hero" />
        </ScreenShell>
      ) : null}
    </StoreContext.Provider>
  );
}

describe("Morph", () => {
  it("renders a box carrying the morph marker", () => {
    const { getByTestId } = render(<Scene pushed={false} />);
    const element = getByTestId("thumb");
    expect(element.hasAttribute("data-flemo-morph")).toBe(true);
  });

  it("hands the runtime both sides, so the arrival starts on its partner", () => {
    const { getByTestId, rerender } = render(<Scene pushed={false} />);

    // The flip has to reach the store while the source is still at rest: that
    // is the one moment its rect is where the user last saw it.
    act(() => {
      stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    });
    rerender(<Scene pushed />);

    const hero = getByTestId("hero");
    const thumb = getByTestId("thumb");
    expect(hero.style.animation).toContain("flemo-morph-");
    expect(hero.getAttribute("data-flemo-morph")).toBe("enter");
    expect(thumb.getAttribute("data-flemo-morph")).toBe("exit");
  });

  it("gives the consumer the same node the runtime flies", () => {
    // A consumer's ref is how they reach their own element — an IntersectionObserver,
    // a measurement, a focus call. It has to be the BOX, not the slot, because
    // the slot is `display: contents` and has no box at all.
    let fromCallback: HTMLElement | null = null;
    const objectRef: { current: HTMLDivElement | null } = { current: null };

    const { getByTestId, rerender } = render(
      <StoreContext.Provider value={stores}>
        <ScreenShell isActive>
          <Morph
            layoutId="photo-1"
            data-testid="thumb"
            ref={(node: HTMLDivElement | null) => {
              fromCallback = node;
            }}
          />
        </ScreenShell>
      </StoreContext.Provider>
    );

    expect(fromCallback).toBe(getByTestId("thumb"));

    rerender(
      <StoreContext.Provider value={stores}>
        <ScreenShell isActive>
          <Morph layoutId="photo-1" data-testid="thumb" ref={objectRef} />
        </ScreenShell>
      </StoreContext.Provider>
    );

    expect(objectRef.current).toBe(getByTestId("thumb"));
  });

  it("pins a morph on a resting screen instead of flipping it every navigation", () => {
    // Same rule as <Part>: without the pin, every navigation in the app would
    // run every stacked screen's morphs through PUSHING and back, re-registering
    // elements nothing can see.
    const { getByTestId } = render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider value={{ ...base, isActive: false, isPrev: true }}>
          <div
            data-flemo-screen=""
            data-flemo-transition="layout"
            data-flemo-status="COMPLETED"
            data-flemo-active="false"
          >
            <Morph layoutId="photo-1" data-testid="thumb" />
          </div>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

    act(() => {
      stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    });

    // Nothing staged it, and nothing marked it: it is not in this flight.
    expect(getByTestId("thumb").getAttribute("data-flemo-morph")).toBe("");
  });

  it("passes its props through to the box", () => {
    const { getByTestId } = render(
      <StoreContext.Provider value={stores}>
        <ScreenShell isActive>
          <Morph layoutId="photo-1" name="shared" className="card" data-testid="thumb">
            <span>caption</span>
          </Morph>
        </ScreenShell>
      </StoreContext.Provider>
    );

    const element = getByTestId("thumb");
    expect(element.className).toBe("card");
    expect(element.getAttribute("data-flemo-morph-name")).toBe("shared");
    expect(element.textContent).toBe("caption");
  });

  it("says which flight it is on, so a shared bar does not have to be guessed at", () => {
    // The runtime cannot read this off the tree for a morph in a SHARED BAR:
    // the bar is a sibling of its own screen scope, so the nearest
    // [data-flemo-screen] belongs to some other Router or to nothing. The
    // binding is standing in the enclosing Screen and simply knows.
    const { getByTestId } = render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider
          value={{ ...base, navigateStore: stores.navigate, routerId: "router-1" }}
        >
          <Morph layoutId="photo-1" data-testid="thumb" />
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

    const element = getByTestId("thumb");
    expect(element.getAttribute("data-flemo-router")).toBe("router-1");
    expect(element.getAttribute("data-flemo-transition")).toBe("layout");
    expect(element.getAttribute("data-flemo-status")).toBe("IDLE");
    expect(element.getAttribute("data-flemo-active")).toBe("true");
  });

  it("says nothing when it is not in a screen at all", () => {
    // Persistent chrome beside the <Slot> — a mini player — has no side of a
    // flight to be on, and the runtime pairs it precisely BECAUSE it answers
    // nothing. An active flag invented here would read as "arriving" on a pop.
    const { getByTestId } = render(
      <StoreContext.Provider value={stores}>
        <Morph layoutId="track-1" data-testid="thumb" />
      </StoreContext.Provider>
    );

    const element = getByTestId("thumb");
    expect(element.hasAttribute("data-flemo-status")).toBe(false);
    expect(element.hasAttribute("data-flemo-active")).toBe(false);
    expect(element.hasAttribute("data-flemo-router")).toBe(false);
  });
});
