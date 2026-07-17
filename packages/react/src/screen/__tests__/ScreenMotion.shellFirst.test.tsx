import { StrictMode, useLayoutEffect, type ReactNode } from "react";

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type History, type TransitionName } from "@flemo/core";

import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// Shell-first children deferral through the React binding. A screen that MOUNTS
// straight into a transition (holdKey !== null on its first render) renders its
// SHELL in the first commit and mounts consumer `children` a commit later, after
// the anim-hold has released. A rest / hydration mount and a revealed frozen
// screen (which never remounts) render children immediately. These drive real
// ScreenMotion instances and assert the child's presence across the commits.

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

describe("ScreenMotion shell-first children deferral", () => {
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

  // Flush the queued rAFs and the microtask (startTransition) they schedule,
  // repeatedly and with advancing timestamps, so the hold releases AND the
  // deferred children commit lands.
  const settle = async () => {
    for (let round = 0; round < 6; round++) {
      await act(async () => {
        frames.splice(0).forEach((frameCallback) => frameCallback(round * 16));
      });
      await act(async () => {
        for (let hop = 0; hop < 8; hop++) await Promise.resolve();
      });
    }
  };

  const enteringPush = (child: ReactNode, wrap: (node: ReactNode) => ReactNode = (n) => n) => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-1" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("below"), historyEntry("entering")]
    });
    return render(
      wrap(
        <StoreContext.Provider value={stores}>
          <ScreenContext.Provider
            value={screenContext({ id: "entering", isActive: true, zIndex: 1 })}
          >
            <ScreenMotion sharedTopBar={<div>bar</div>}>{child}</ScreenMotion>
          </ScreenContext.Provider>
        </StoreContext.Provider>
      )
    );
  };

  it("withholds children in the first commit but renders the shell, then mounts children after release", async () => {
    const { container, queryByTestId } = enteringPush(<div data-testid="content">heavy</div>);

    // First commit: the shell is present, the consumer child is not.
    expect(container.querySelector("[data-flemo-screen]")).not.toBeNull();
    expect(container.querySelector('[data-flemo-bar="app"]')).not.toBeNull();
    expect(container.querySelector("[data-flemo-decorator]")).not.toBeNull();
    expect(
      container.querySelector("[data-flemo-screen]")?.getAttribute("data-flemo-anim-hold")
    ).toBe("true");
    expect(queryByTestId("content")).toBeNull();

    await settle();

    // After the hold releases and the deferred commit lands, children are in.
    expect(
      container.querySelector("[data-flemo-screen]")?.getAttribute("data-flemo-anim-hold")
    ).toBe("false");
    expect(queryByTestId("content")).not.toBeNull();
  });

  it("mounts the deferred children only after the release commit (never before)", async () => {
    const holdAtMount: (string | null)[] = [];
    function OrderProbe() {
      useLayoutEffect(() => {
        const scope = document.querySelector("[data-flemo-screen]");
        holdAtMount.push(scope?.getAttribute("data-flemo-anim-hold") ?? null);
      }, []);
      return <div data-testid="content">child</div>;
    }

    const { queryByTestId } = enteringPush(<OrderProbe />);
    expect(queryByTestId("content")).toBeNull();

    await settle();

    expect(queryByTestId("content")).not.toBeNull();
    // The child mounted exactly once, and the hold had already released to
    // "false" by then — the children commit never precedes the release commit.
    expect(holdAtMount).toEqual(["false"]);
  });

  it("is Strict-mode safe: the ref-captured predicate defers exactly once", async () => {
    const { queryByTestId } = enteringPush(<div data-testid="content">heavy</div>, (node) => (
      <StrictMode>{node}</StrictMode>
    ));

    // Double-invoked render still latches one deferral: no child in commit one.
    expect(queryByTestId("content")).toBeNull();

    await settle();
    expect(queryByTestId("content")).not.toBeNull();
  });

  it("does not defer a rest mount (no hold): children render immediately", () => {
    stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    stores.history.setState({ index: 0, histories: [historyEntry("root")] });

    const { queryByTestId } = render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider
          value={screenContext({ id: "root", isActive: true, isRoot: true, zIndex: 0 })}
        >
          <ScreenMotion>
            <div data-testid="content">at rest</div>
          </ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

    expect(queryByTestId("content")).not.toBeNull();
  });

  it("does not re-defer a screen that mounted at rest and is later revealed (no remount)", async () => {
    stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    stores.history.setState({ index: 0, histories: [historyEntry("s")] });

    // The revealed screen is the SAME component instance across the two renders,
    // so its shell-first ref stays captured from the rest mount (false).
    function Reveal({ active }: { active: boolean }) {
      return (
        <StoreContext.Provider value={stores}>
          <ScreenContext.Provider
            value={screenContext({ id: "s", isActive: active, isPrev: !active, zIndex: 0 })}
          >
            <ScreenMotion>
              <div data-testid="content">revealed</div>
            </ScreenMotion>
          </ScreenContext.Provider>
        </StoreContext.Provider>
      );
    }

    const { rerender, queryByTestId } = render(<Reveal active />);
    expect(queryByTestId("content")).not.toBeNull();

    // A pop begins revealing this screen beneath the exiting top: the same
    // instance re-renders (never remounts), so children are never withheld.
    await act(async () => {
      stores.navigate.setState({ status: "POPPING", transitionTaskId: "task-pop" });
      stores.history.setState({ index: 1, histories: [historyEntry("s"), historyEntry("top")] });
    });
    rerender(<Reveal active={false} />);

    expect(queryByTestId("content")).not.toBeNull();
  });
});
