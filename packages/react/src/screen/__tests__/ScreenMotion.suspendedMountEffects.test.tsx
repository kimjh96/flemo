import { Suspense, use, useEffect, type ReactNode } from "react";

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

// ─────────────────────────────────────────────────────────────────────────────
// Shell-first NEUTRALIZES the suspended-mount hold artifact.
//
// Before shell-first, an entering screen's child that suspended during the mount
// commit withheld that whole commit's passive effects (a jsdom + `act`
// artifact), so ScreenMotion's readiness rAF was never scheduled and the hold
// never released. Shell-first changes the shape: the entering screen's consumer
// `children` are DEFERRED out of the first commit, so the first commit is the
// SHELL alone — no suspending child, its passive effects run, the readiness rAF
// is scheduled, and the hold releases. Any suspense now lives in the LATER,
// deferred children commit, after the transition has already started.
//
// These tests drive the entering screen (active, REPLACING) beside a
// non-deferring leftover sibling (inactive) and show the hold releasing whether
// or not the deferred child suspends.
// ─────────────────────────────────────────────────────────────────────────────

const TAB = "diag-suspend" as TransitionName;

const entry = (id: string): History => ({
  id,
  pathname: "/",
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
  pathname: "/",
  params: {},
  transitionName: TAB,
  prevTransitionName: TAB,
  layoutId: null,
  routePath: "/",
  ...o
});

let effectRan = 0;
function Probe() {
  useEffect(() => {
    effectRan += 1;
  });
  return null;
}

describe("suspended-mount anim-hold (jsdom characterization)", () => {
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
    effectRan = 0;
    stores = createTestStores();
    stores.navigate.setState({ status: "REPLACING", transitionTaskId: "task-replace" });
    stores.history.setState({ index: 1, histories: [entry("leftover"), entry("entering")] });
    frames = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  const renderPair = (enteringChildren: ReactNode) =>
    render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider
          value={ctx({ id: "leftover", isActive: false, isPrev: false, zIndex: 0 })}
        >
          <ScreenMotion data-testid="exit">
            <div>home</div>
          </ScreenMotion>
        </ScreenContext.Provider>
        <ScreenContext.Provider value={ctx({ id: "entering", isActive: true, zIndex: 1 })}>
          <ScreenMotion data-testid="enter">
            <Probe />
            {enteringChildren}
          </ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

  const runFrames = async () => {
    for (let round = 0; round < 6; round++) {
      await act(async () => {
        frames.splice(0).forEach((cb) => cb(round * 16));
      });
      await act(async () => {
        for (let hop = 0; hop < 8; hop++) await Promise.resolve();
      });
    }
  };

  it("control (no suspense): the shell commits, the readiness rAF is scheduled, and the pair releases", async () => {
    const { getByTestId, queryByTestId } = renderPair(<div data-testid="feed">feed</div>);
    const enter = getByTestId("enter");
    const exit = getByTestId("exit");

    // The entering screen deferred its children, so neither the Probe nor the
    // feed is in the first commit — but the shell's passive effects ran and
    // scheduled the readiness rAF.
    expect(queryByTestId("feed")).toBeNull();
    expect(effectRan).toBe(0);
    expect(frames.length).toBeGreaterThan(0);

    await runFrames();

    // The hold released and the deferred children mounted: Probe's effect ran
    // and the feed is in.
    expect(enter.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(exit.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(queryByTestId("feed")).not.toBeNull();
    expect(effectRan).toBe(1);
  });

  it("suspending deferred child: the hold still releases against the shell", async () => {
    const pending = new Promise<void>(() => {});
    function Feed() {
      use(pending);
      return <div data-testid="feed">feed</div>;
    }
    const { getByTestId, queryByTestId } = renderPair(
      <Suspense fallback={<div data-testid="sk" />}>
        <Feed />
      </Suspense>
    );
    const enter = getByTestId("enter");
    const exit = getByTestId("exit");

    // The suspense is deferred out of the first commit, so the first commit is
    // the shell alone: no skeleton, no Probe effect, but the readiness rAF IS
    // scheduled — exactly what the old artifact used to withhold.
    expect(queryByTestId("sk")).toBeNull();
    expect(effectRan).toBe(0);
    expect(frames.length).toBeGreaterThan(0);

    await runFrames();

    // Shell-first decouples the suspense from the hold: the pair releases
    // against the shell even though the deferred child suspends forever.
    expect(enter.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(exit.getAttribute("data-flemo-anim-hold")).toBe("false");
  });
});
