import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TaskManger,
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
// REGRESSION through the real binding: the bottom-tab replace "single-frame cut"
// (iOS Safari, plen 1.6.8), reduced to the mechanism jsdom can drive — now FIXED
// by cancel-resume liveness on every participant.
//
// Device chain: a tab switch is `replace(path, undefined, { transitionName })` at
// depth 1. The leftover exit (REPLACING-false) and the fresh entering screen
// (REPLACING-true) crossfade for 150ms. On the entering screen the feed SUSPENDS
// during mount; the DelayedSkeleton fallback commit invalidates both screens'
// compositor layers on WebKit and silently cancels their running CSS animations
// (animationcancel, no animationend).
//
// This suite mounts two REAL ScreenMotion instances as a depth-1 REPLACING pair,
// releases the anim-hold, then delivers the WebKit-style cancels DIRECTLY (jsdom
// cannot fire a compositor cancel, and rendering an actually-suspending child
// deadlocks passive-effect flushing inside `act` — see diag.suspend.test.tsx).
// It proves, end-to-end through the binding, that the fix holds:
//   1. the LEFTOVER (passive/exit) screen now RESUMES its cancelled exit fade
//      (the restart trick runs) instead of dropping it; and
//   2. the ENTERING (active) screen RESUMES a rapid second cancel (the
//      suspended-mount churn) rather than resolving early into a COMPLETED cut.
//
// A crossfade whose enter AND exit are both non-player-drivable (mismatched
// clipPath templates) so both sides take the compiled-CSS recovery path — the
// path the affected device uses.
// ─────────────────────────────────────────────────────────────────────────────

const TAB = "tab-forward-cut" as TransitionName;

const registerCrossfade = () =>
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

const screenAnim = (variant: "REPLACING-true" | "REPLACING-false") =>
  `flemo-screen-tab-forward-cut-${variant}`;

const historyEntry = (id: string): History => ({
  id,
  pathname: "/",
  params: {},
  transitionName: TAB,
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
  transitionName: TAB,
  prevTransitionName: TAB,
  layoutId: null,
  routePath: "/",
  ...overrides
});

function ReplacePair({ stores }: { stores: FlemoStores }) {
  return (
    <StoreContext.Provider value={stores}>
      {/* Leftover top, exiting. Depth-1 root replace: the leftover sits at
          zIndex 0, index 1 → isPrev is false (createScreenSelector). */}
      <ScreenContext.Provider
        value={screenContext({ id: "leftover", isActive: false, isPrev: false, zIndex: 0 })}
      >
        <ScreenMotion data-testid="exit">
          <div>home</div>
        </ScreenMotion>
      </ScreenContext.Provider>
      <ScreenContext.Provider value={screenContext({ id: "entering", isActive: true, zIndex: 1 })}>
        <ScreenMotion data-testid="enter">
          <div>region</div>
        </ScreenMotion>
      </ScreenContext.Provider>
    </StoreContext.Provider>
  );
}

const cancelOn = (el: HTMLElement, name: string) => {
  const event = new Event("animationcancel");
  Object.defineProperty(event, "animationName", { value: name });
  el.dispatchEvent(event);
};

describe("ScreenMotion depth-1 replace: suspended-mount single-frame cut", () => {
  let stores: FlemoStores;
  let frames: FrameRequestCallback[];
  let resolveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registerCrossfade();
    stores = createTestStores();
    stores.navigate.setState({ status: "REPLACING", transitionTaskId: "task-replace" });
    stores.history.setState({
      index: 1,
      histories: [historyEntry("leftover"), historyEntry("entering")]
    });
    frames = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const releaseHold = async () => {
    // Two frames + microtasks: the paint anchor elapses and the pair releases.
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

  it("resumes both the exit and the entering fade on cancel — no single-frame cut", async () => {
    const { getByTestId } = render(<ReplacePair stores={stores} />);
    const enter = getByTestId("enter");
    const exit = getByTestId("exit");

    await releaseHold();
    expect(enter.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(exit.getAttribute("data-flemo-anim-hold")).toBe("false");

    // The WebKit compositor cancels the EXIT screen's fade too. The passive side
    // now wires cancel-resume: the restart trick runs, and it resolves nothing
    // (passive has no task).
    const exitRemoveSpy = vi.spyOn(exit.style, "removeProperty");
    cancelOn(exit, screenAnim("REPLACING-false"));
    expect(exitRemoveSpy).toHaveBeenCalledWith("animation"); // restart trick ran
    expect(resolveSpy).not.toHaveBeenCalled();
    exitRemoveSpy.mockRestore();

    // The entering screen: BOTH the suspended mount and its fallback-commit
    // churn cancel the fade, and both are RESUMED (budget 4). Neither resolves
    // the task, so COMPLETED never cuts the leftover mid-crossfade.
    const enterRemoveSpy = vi.spyOn(enter.style, "removeProperty");
    cancelOn(enter, screenAnim("REPLACING-true"));
    expect(enterRemoveSpy).toHaveBeenCalledWith("animation"); // restart trick ran
    expect(resolveSpy).not.toHaveBeenCalled();

    cancelOn(enter, screenAnim("REPLACING-true"));
    expect(resolveSpy).not.toHaveBeenCalled(); // still resuming, not cut
    enterRemoveSpy.mockRestore();
  });
});
