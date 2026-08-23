import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine, {
  resetDisplayProbeForTests
} from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// Who gets the governed head kit on touch Blink, and — the point of this file
// — who must NOT.
//
// The kit (held head + `data-flemo-governed` gated keyframes) exists for a device
// whose mount commits would age a bare compiled flight's clock past its whole
// opening. `isLegacyAndroidBlink()` selects that class: Android, touch, no
// UA-CH brands.
//
// A `css` force pin must not select it. The pin changes no routing on Blink
// (every Blink flight already routes compiled), so if it also flipped the kit
// on, a pinned session would run a DIFFERENT motion than the same device runs
// in production — an instrument that alters what it observes. The condition
// carried exactly that bug through a `!playerAllowed()` term, which
// meant "demoted device" until demotion was retired (2026-08-19) and then
// silently meant "css pin".

const animated = createTransition({
  name: "governed-head-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const NAV = navigator as { userAgentData?: unknown };
const LPM_ATTR = "data-flemo-governed";

describe("governed head kit on touch Blink", () => {
  let deps: TransitionEngineDeps;
  let scope: HTMLDivElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let disposers: (() => void)[];
  let originalUserAgent: string;

  const setUserAgent = (value: string) => {
    Object.defineProperty(navigator, "userAgent", { value, configurable: true });
  };

  beforeEach(() => {
    transitionMap.set("governed-head-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-governed-head"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    scope = document.createElement("div");
    document.body.appendChild(scope);
    originalUserAgent = navigator.userAgent;
    // A touch Blink phone.
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    setUserAgent("Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/79 Mobile");
    resetDisplayProbeForTests();
    document.documentElement.removeAttribute(LPM_ATTR);
    disposers = [];
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    vi.unstubAllGlobals();
    scope.remove();
    transitionMap.delete("governed-head-test" as never);
    resolveSpy.mockRestore();
    delete NAV.userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    setUserAgent(originalUserAgent);
    document.documentElement.removeAttribute(LPM_ATTR);
  });

  const drive = () => {
    const engine = createTransitionEngine(deps);
    disposers.push(
      engine.driveScreenLifecycle({
        getElements: () => ({ scope }),
        transitionName: "governed-head-test" as never,
        prevTransitionName: "governed-head-test" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      })
    );
  };

  const governed = () => document.documentElement.hasAttribute(LPM_ATTR);

  it("engages for a legacy Android Blink session (no UA-CH brands)", () => {
    // No userAgentData at all — the confidently-pre-2021 signal.
    drive();
    expect(governed()).toBe(true);
  });

  it("stays off for a modern touch Blink session", () => {
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    drive();
    expect(governed()).toBe(false);
  });
});
