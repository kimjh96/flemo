import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine, {
  resetDisplayProbeForTests
} from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// The DESKTOP flat head (`flemo:deskhead`, `:root[data-flemo-desk-head]`).
//
// Desktop macOS Safari runs the compiled tier by joinPlayer's gate 3 and WebKit
// presents that clock from the main thread, so the release-to-glass pipeline is
// aging it before a single frame is shown. The head is the touch tier's cure,
// re-sized for a 60Hz pipeline: pure gate-scoped style, no WAAPI write.
//
// Two things must hold, and both are why this file exists. The gate must select
// desktop Mac WebKit and nothing else — a touch session already has its own head
// under a different attribute with different lengths. And arming it must RETIRE
// the birth anchor for the same flight: the anchor rewinds the clock the head has
// already covered, and two corrections of one clock fight each other.

const anchorCalls = vi.hoisted(() => ({ atRelease: 0 }));

vi.mock("@core/engine/nativeStallAnchor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@core/engine/nativeStallAnchor")>();
  return {
    ...actual,
    armFlightStartAnchorAtRelease: (
      ...args: Parameters<typeof actual.armFlightStartAnchorAtRelease>
    ) => {
      anchorCalls.atRelease += 1;
      return actual.armFlightStartAnchorAtRelease(...args);
    }
  };
});

const animated = createTransition({
  name: "desk-head-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const DESK_ATTR = "data-flemo-desk-head";
const LPM_ATTR = "data-flemo-lpm";

describe("desktop flat head", () => {
  let deps: TransitionEngineDeps;
  let scope: HTMLDivElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let disposers: (() => void)[];

  const asDesktopSafari = () => {
    delete (navigator as { userAgentData?: unknown }).userAgentData;
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
  };

  beforeEach(() => {
    transitionMap.set("desk-head-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-desk-head"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    scope = document.createElement("div");
    document.body.appendChild(scope);
    anchorCalls.atRelease = 0;
    resetDisplayProbeForTests();
    document.documentElement.removeAttribute(DESK_ATTR);
    document.documentElement.removeAttribute(LPM_ATTR);
    disposers = [];
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    vi.unstubAllGlobals();
    scope.remove();
    transitionMap.delete("desk-head-test" as never);
    resolveSpy.mockRestore();
    delete (navigator as { userAgentData?: unknown }).userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    delete (navigator as unknown as Record<string, unknown>).platform;
    document.documentElement.removeAttribute(DESK_ATTR);
    document.documentElement.removeAttribute(LPM_ATTR);
    sessionStorage.clear();
  });

  const drive = () => {
    const engine = createTransitionEngine(deps);
    disposers.push(
      engine.driveScreenLifecycle({
        getElements: () => ({ scope }),
        transitionName: "desk-head-test" as never,
        prevTransitionName: "desk-head-test" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      })
    );
  };

  const headed = () => document.documentElement.hasAttribute(DESK_ATTR);

  it("engages for a desktop macOS Safari session", () => {
    asDesktopSafari();
    drive();
    expect(headed()).toBe(true);
    // The touch tier's gate stays down: its head has different lengths.
    expect(document.documentElement.hasAttribute(LPM_ATTR)).toBe(false);
  });

  it("retires the birth anchor while the head covers the flight", () => {
    asDesktopSafari();
    drive();
    expect(anchorCalls.atRelease).toBe(0);
  });

  it("keeps the birth anchor under an explicit flemo:deskhead=off", () => {
    asDesktopSafari();
    sessionStorage.setItem("flemo:deskhead", "off");
    drive();
    expect(headed()).toBe(false);
    expect(anchorCalls.atRelease).toBeGreaterThan(0);
  });

  it("stays off for touch WebKit and for a non-Mac desktop", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
    drive();
    expect(headed()).toBe(false);

    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true });
    drive();
    expect(headed()).toBe(false);
  });
});
