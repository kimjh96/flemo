import { describe, expect, it, vi } from "vitest";

import type { History } from "@history/store";

import type { NavigateStatus } from "@navigate/store";

import driveBarRiding from "@core/engine/barRiding";

const RIDING = "data-flemo-bar-riding";
const bars = () => ({
  appBar: document.createElement("div"),
  navBar: document.createElement("div")
});
const history = (id: string) => ({ id }) as unknown as History;

describe("driveBarRiding", () => {
  it("rides only the bar the partner screen does not own, during a transition", () => {
    const { appBar, navBar } = bars();
    const dispose = driveBarRiding({
      appBar,
      navBar,
      isTopOrTopPrev: true,
      isActive: true, // partner = histories[index - 1]
      index: 1,
      hasAppBar: true,
      hasNavBar: true,
      getStatus: () => "PUSHING",
      getHistories: () => [history("a"), history("b")],
      getSharedBars: () => ({ a: { appBar: true, navigationBar: false } }),
      subscribeStatus: () => () => {},
      subscribeSharedBars: () => () => {}
    });

    // Partner "a" owns the app bar (don't ride) but not the nav bar (ride).
    expect(appBar.getAttribute(RIDING)).toBe("false");
    expect(navBar.getAttribute(RIDING)).toBe("true");

    dispose();
    expect(appBar.hasAttribute(RIDING)).toBe(false);
    expect(navBar.hasAttribute(RIDING)).toBe(false);
  });

  it("clears the attribute when not transitioning", () => {
    const { appBar, navBar } = bars();
    appBar.setAttribute(RIDING, "true");
    driveBarRiding({
      appBar,
      navBar,
      isTopOrTopPrev: true,
      isActive: true,
      index: 1,
      hasAppBar: true,
      hasNavBar: true,
      getStatus: () => "COMPLETED",
      getHistories: () => [],
      getSharedBars: () => ({}),
      subscribeStatus: () => () => {},
      subscribeSharedBars: () => () => {}
    });
    expect(appBar.hasAttribute(RIDING)).toBe(false);
    expect(navBar.hasAttribute(RIDING)).toBe(false);
  });

  it("re-applies when a subscriber fires (partner registers late)", () => {
    const { appBar, navBar } = bars();
    let status: NavigateStatus = "COMPLETED";
    let fire = () => {};
    driveBarRiding({
      appBar,
      navBar,
      isTopOrTopPrev: true,
      isActive: true,
      index: 1,
      hasAppBar: true,
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

    expect(appBar.hasAttribute(RIDING)).toBe(false); // not transitioning yet
    status = "PUSHING";
    fire();
    expect(appBar.getAttribute(RIDING)).toBe("true");
  });

  it("unsubscribes from both stores on dispose", () => {
    const unsubStatus = vi.fn();
    const unsubSharedBars = vi.fn();
    const { appBar, navBar } = bars();
    const dispose = driveBarRiding({
      appBar,
      navBar,
      isTopOrTopPrev: false,
      isActive: false,
      index: 1,
      hasAppBar: true,
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
