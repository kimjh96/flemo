import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine, {
  resetDisplayProbeForTests
} from "@core/engine/createTransitionEngine";
import { heldDesktopHead, holdDesktopHeadGate, resetHeadGateForTests } from "@core/engine/headGate";
import { resolveHeadKit } from "@core/engine/transitionRouting";
import { reportReleaseLatencyMs, resetReleaseLatencyForTests } from "@platform/releaseLatency";

import type { TransitionEngineDeps } from "@core/engine/types";

// ONE ROOT ATTRIBUTE, EVERY ROUTER ON THE PAGE.
//
// `data-flemo-desk-head` gates the compiled head rules for every participant in
// the document. On desktop Blink whether a transition wears the head follows
// the release latency measured per status, so two transitions can disagree.
// When they overlap (a nested demo playing itself inside a screen the shell is
// leaving), the second flipping the gate swapped the first's animation-name
// and restarted it from its first frame: measured on flemo.dev as the docs
// page's demo sliding in again under the Home transition.

const animated = createTransition({
  name: "head-gate-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const DESK_ATTR = "data-flemo-desk-head";
const NAV = navigator as { userAgentData?: unknown };

const asDesktopChrome = () => {
  NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
  Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
};

afterEach(() => {
  resetHeadGateForTests();
  resetReleaseLatencyForTests();
  delete NAV.userAgentData;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  sessionStorage.clear();
});

describe("headGate", () => {
  it("holds nothing while nothing runs", () => {
    expect(heldDesktopHead()).toBe(null);
  });

  it("holds the gate until the last holder releases it", () => {
    const first = holdDesktopHeadGate(true);
    const second = holdDesktopHeadGate(true);
    first();
    expect(heldDesktopHead()).toBe(true);
    second();
    expect(heldDesktopHead()).toBe(null);
  });

  it("makes a release idempotent", () => {
    const release = holdDesktopHeadGate(false);
    const other = holdDesktopHeadGate(false);
    release();
    release();
    expect(heldDesktopHead()).toBe(false);
    other();
  });

  it("routes a transition that starts while the gate is held with the held answer", () => {
    asDesktopChrome();
    // The session has measured a one-frame push, so a fresh decision drops the head.
    reportReleaseLatencyMs("PUSHING", 4);
    expect(resolveHeadKit("PUSHING").desktopHead).toBe(false);

    const release = holdDesktopHeadGate(true);
    const kit = resolveHeadKit("PUSHING");
    expect(kit.desktopHead).toBe(true);
    // The head length follows the answer, so a morph staged against the same
    // kit runs on the same clock as the screen carrying it.
    expect(kit.headMs).toBeGreaterThan(0);

    release();
    expect(resolveHeadKit("PUSHING").desktopHead).toBe(false);
  });
});

describe("the engine holds the root gate while its transition runs", () => {
  let deps: TransitionEngineDeps;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  const scopes: HTMLDivElement[] = [];
  const disposers: (() => void)[] = [];

  beforeEach(() => {
    asDesktopChrome();
    transitionMap.set("head-gate-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-head-gate"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);
    resetDisplayProbeForTests();
    document.documentElement.removeAttribute(DESK_ATTR);
  });

  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    for (const scope of scopes.splice(0)) scope.remove();
    transitionMap.delete("head-gate-test" as never);
    resolveSpy.mockRestore();
    document.documentElement.removeAttribute(DESK_ATTR);
  });

  const drive = (status: "PUSHING" | "POPPING") => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    scopes.push(scope);
    const dispose = createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "head-gate-test" as never,
      prevTransitionName: "head-gate-test" as never,
      status,
      isActive: true,
      animHoldReleased: true
    });
    disposers.push(dispose);
    return dispose;
  };

  const headed = () => document.documentElement.hasAttribute(DESK_ATTR);

  it("keeps the head on for a transition running in another Router", () => {
    // A nested Router's push is running with the head (nothing measured yet).
    drive("PUSHING");
    expect(headed()).toBe(true);

    // The session has since measured a one-frame push. A second Router's push
    // starting now would drop the head and restart the running one.
    reportReleaseLatencyMs("PUSHING", 4);
    drive("PUSHING");
    expect(headed()).toBe(true);
  });

  it("decides freshly once every transition has settled", () => {
    const first = drive("PUSHING");
    reportReleaseLatencyMs("PUSHING", 4);
    first();
    drive("PUSHING");
    expect(headed()).toBe(false);
  });

  it("keeps holding for the newcomer after the first transition settles", () => {
    const first = drive("PUSHING");
    reportReleaseLatencyMs("PUSHING", 4);
    drive("PUSHING");
    first();
    // The second transition is still running on the head it started with.
    expect(heldDesktopHead()).toBe(true);
  });
});
