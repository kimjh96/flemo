import { describe, expect, it, vi } from "vitest";

import type { History } from "@history/store";

import type { NavigateStatus } from "@navigate/store";

import driveBarRiding from "@core/engine/barRiding";

const RIDING = "data-flemo-bar-riding";
const bars = () => ({
  topBar: document.createElement("div"),
  navBar: document.createElement("div")
});
const history = (id: string) => ({ id }) as unknown as History;

describe("driveBarRiding", () => {
  it("rides only the bar the partner screen does not own, during a transition", () => {
    const { topBar, navBar } = bars();
    const dispose = driveBarRiding({
      topBar,
      navBar,
      isTopOrTopPrev: true,
      isActive: true, // partner = histories[index - 1]
      index: 1,
      hasTopBar: true,
      hasNavBar: true,
      getStatus: () => "PUSHING",
      getHistories: () => [history("a"), history("b")],
      getSharedBars: () => ({ a: { topBar: true, bottomBar: false } }),
      subscribeStatus: () => () => {},
      subscribeSharedBars: () => () => {}
    });

    // Partner "a" owns the app bar (don't ride) but not the nav bar (ride).
    expect(topBar.getAttribute(RIDING)).toBe("false");
    expect(navBar.getAttribute(RIDING)).toBe("true");

    dispose();
    expect(topBar.hasAttribute(RIDING)).toBe(false);
    expect(navBar.hasAttribute(RIDING)).toBe(false);
  });

  it("clears the attribute when not transitioning", () => {
    const { topBar, navBar } = bars();
    topBar.setAttribute(RIDING, "true");
    driveBarRiding({
      topBar,
      navBar,
      isTopOrTopPrev: true,
      isActive: true,
      index: 1,
      hasTopBar: true,
      hasNavBar: true,
      getStatus: () => "COMPLETED",
      getHistories: () => [],
      getSharedBars: () => ({}),
      subscribeStatus: () => () => {},
      subscribeSharedBars: () => () => {}
    });
    expect(topBar.hasAttribute(RIDING)).toBe(false);
    expect(navBar.hasAttribute(RIDING)).toBe(false);
  });

  it("re-applies when a subscriber fires (partner registers late)", () => {
    const { topBar, navBar } = bars();
    let status: NavigateStatus = "COMPLETED";
    let fire = () => {};
    driveBarRiding({
      topBar,
      navBar,
      isTopOrTopPrev: true,
      isActive: true,
      index: 1,
      hasTopBar: true,
      hasNavBar: false,
      getStatus: () => status,
      getHistories: () => [history("a"), history("b")],
      getSharedBars: () => ({}), // partner owns nothing → app bar rides once transitioning
      subscribeStatus: (listener) => {
        fire = listener;
        return () => {};
      },
      subscribeSharedBars: () => () => {}
    });

    expect(topBar.hasAttribute(RIDING)).toBe(false); // not transitioning yet
    status = "PUSHING";
    fire();
    expect(topBar.getAttribute(RIDING)).toBe("true");
  });

  it("unsubscribes from both stores on dispose", () => {
    const unsubStatus = vi.fn();
    const unsubSharedBars = vi.fn();
    const { topBar, navBar } = bars();
    const dispose = driveBarRiding({
      topBar,
      navBar,
      isTopOrTopPrev: false,
      isActive: false,
      index: 1,
      hasTopBar: true,
      hasNavBar: true,
      getStatus: () => "PUSHING",
      getHistories: () => [],
      getSharedBars: () => ({}),
      subscribeStatus: () => unsubStatus,
      subscribeSharedBars: () => unsubSharedBars
    });
    dispose();
    expect(unsubStatus).toHaveBeenCalledTimes(1);
    expect(unsubSharedBars).toHaveBeenCalledTimes(1);
  });
});
