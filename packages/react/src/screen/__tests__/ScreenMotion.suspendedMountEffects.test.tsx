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
// CHARACTERIZATION (jsdom, not the device defect): what a suspended-mount
// commit does to the anim-hold in the test environment.
//
// The anim-hold ATTRIBUTE is rendered in-commit, but its RELEASE runs from a
// passive `useEffect` (ScreenMotion's coordinator.join, which schedules the
// readiness rAF). This suite shows that when the entering screen's child
// suspends during the mount commit, jsdom + `act` withhold that whole commit's
// passive effects — for BOTH the suspending screen and its non-suspending
// leftover sibling — so the readiness rAF is never even scheduled and the hold
// never releases.
//
// IMPORTANT: this is an `act`/scheduler artifact of the TEST harness, NOT the
// on-device cause. On the real browser React flushes passive effects a few ms
// after paint regardless of a suspended sibling, so the hold DOES release
// (device evidence: "no 1.2s hang anymore, recovery is firing" — recovery only
// arms after release). The genuine defect lives in the engine's resolution path
// (see createTransitionEngine.replaceSuspenseCut.test.ts). This suite is kept to
// document the harness behavior so a future suspended-mount test doesn't chase
// the artifact.
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
    await act(async () => {
      frames.splice(0).forEach((cb) => cb(0));
    });
    await act(async () => {
      frames.splice(0).forEach((cb) => cb(16));
    });
    await act(async () => {
      for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    });
  };

  it("control (no suspense): passive effects run, rAF is scheduled, the pair releases", async () => {
    const { getByTestId } = renderPair(<div>feed</div>);
    const enter = getByTestId("enter");
    const exit = getByTestId("exit");

    expect(effectRan).toBe(1); // Probe's passive effect ran
    expect(frames.length).toBeGreaterThan(0); // readiness rAF scheduled

    await runFrames();

    expect(enter.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(exit.getAttribute("data-flemo-anim-hold")).toBe("false");
  });

  it("suspending child: the WHOLE commit's passive effects are withheld, so the hold never releases", async () => {
    const pending = new Promise<void>(() => {});
    function Feed() {
      use(pending);
      return <div>feed</div>;
    }
    const { getByTestId } = renderPair(
      <Suspense fallback={<div data-testid="sk" />}>
        <Feed />
      </Suspense>
    );
    const enter = getByTestId("enter");
    const exit = getByTestId("exit");

    // The entering screen committed its chrome + the blank skeleton.
    expect(getByTestId("sk")).toBeTruthy();

    // No passive effect ran (not even the non-suspending Probe, nor the wholly
    // separate leftover), and no readiness rAF was scheduled.
    expect(effectRan).toBe(0);
    expect(frames.length).toBe(0);

    await runFrames();

    // Both screens are stuck at the paused hold.
    expect(enter.getAttribute("data-flemo-anim-hold")).not.toBe("false");
    expect(exit.getAttribute("data-flemo-anim-hold")).not.toBe("false");
    expect(effectRan).toBe(0);
  });
});
