import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import driverPolicy from "@core/engine/driverPolicy";
import { createMidFlightCommitLatch } from "@core/engine/midFlightCommitLatch";
import { SKIP_ANIMATION_ATTR, type TransitionEngineDeps } from "@core/engine/types";

// Shell-first compositor takeover: when an entering screen deferred its children
// to a mid-flight commit (midFlightCommitExpected), the engine declines the rAF
// player and lets the compiled-CSS compositor drive BOTH participants.
//
// The player is enabled here by spying on the driverPolicy singleton, NOT via
// the diagnostic force key — because the pin OVERRIDES the takeover (see the
// pin-precedence test), the force key would mask exactly the decline these
// tests assert. Spying playerAllowed→true / pinned→false gives the one state
// jsdom cannot otherwise reach: the player available under AUTOMATIC selection.
//
// A player-drivable variant (pure x → the numeric tier) suppresses the compiled
// animation with `animation: none` the instant it joins, so `scope.style
// .animation` is the join probe: "none" = player joined, "" = declined (CSS).

const playerDrivable = createTransition({
  name: "takeover-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-35%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const newScope = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

const baseInput = (scope: HTMLElement) => ({
  getElements: () => ({ scope }),
  transitionName: "takeover-test" as never,
  prevTransitionName: "takeover-test" as never,
  status: "PUSHING" as const,
  isActive: true,
  animHoldReleased: true
});

describe("createTransitionEngine shell-first compositor takeover", () => {
  let deps: TransitionEngineDeps;
  let scope: HTMLElement;
  let playerAllowedSpy: ReturnType<typeof vi.spyOn>;
  let pinnedSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    transitionMap.set("takeover-test" as never, playerDrivable);
    // Automatic selection with the player available and NO pin.
    playerAllowedSpy = vi.spyOn(driverPolicy, "playerAllowed").mockReturnValue(true);
    pinnedSpy = vi.spyOn(driverPolicy, "pinned").mockReturnValue(false);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-1"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn(),
      midFlightCommitLatch: createMidFlightCommitLatch()
    };
    scope = newScope();
  });

  afterEach(() => {
    scope.remove();
    transitionMap.delete("takeover-test" as never);
    playerAllowedSpy.mockRestore();
    pinnedSpy.mockRestore();
    vi.useRealTimers();
  });

  it("declines the player for an ACTIVE screen with the hint (CSS drives)", () => {
    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      ...baseInput(scope),
      midFlightCommitExpected: true
    });
    // The player never joined → the compiled animation was never suppressed.
    expect(scope.style.animation).toBe("");
    dispose();
  });

  it("joins the player for the same ACTIVE screen WITHOUT the hint (unchanged)", () => {
    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      ...baseInput(scope),
      midFlightCommitExpected: false
    });
    expect(scope.style.animation).toBe("none");
    dispose();
  });

  it("arms the shared latch so the PASSIVE side follows the active decision", () => {
    const latch = deps.midFlightCommitLatch!;
    const activeEngine = createTransitionEngine(deps);
    const passiveEngine = createTransitionEngine(deps);

    // Active entering screen with the hint arms the latch for task-1.
    const disposeActive = activeEngine.driveScreenLifecycle({
      ...baseInput(scope),
      midFlightCommitExpected: true
    });
    expect(latch.isArmed("task-1")).toBe(true);

    // The exiting screen (a DIFFERENT engine, midFlightCommitExpected false) must
    // still decline the player — it learns the takeover from the latch.
    const passiveScope = newScope();
    const disposePassive = passiveEngine.driveScreenLifecycle({
      getElements: () => ({ scope: passiveScope }),
      transitionName: "takeover-test" as never,
      prevTransitionName: "takeover-test" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true,
      midFlightCommitExpected: false
    });
    expect(passiveScope.style.animation).toBe("");

    disposeActive();
    disposePassive();
    passiveScope.remove();
  });

  it("the diagnostic pin WINS on the PASSIVE side too (armed latch, pinned → joins)", () => {
    // Pin override is symmetric: with the latch armed but the driver pinned, the
    // exiting screen joins the player just like the active side, so the pair
    // never splits under a pin.
    pinnedSpy.mockReturnValue(true);
    deps.midFlightCommitLatch!.arm("task-1");
    const passiveEngine = createTransitionEngine(deps);
    const passiveScope = newScope();
    const dispose = passiveEngine.driveScreenLifecycle({
      getElements: () => ({ scope: passiveScope }),
      transitionName: "takeover-test" as never,
      prevTransitionName: "takeover-test" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true,
      midFlightCommitExpected: false
    });
    expect(passiveScope.style.animation).toBe("none");
    dispose();
    passiveScope.remove();
  });

  it("the PASSIVE side joins the player when the latch is NOT armed", () => {
    const passiveEngine = createTransitionEngine(deps);
    const passiveScope = newScope();
    const dispose = passiveEngine.driveScreenLifecycle({
      getElements: () => ({ scope: passiveScope }),
      transitionName: "takeover-test" as never,
      prevTransitionName: "takeover-test" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true,
      midFlightCommitExpected: false
    });
    expect(passiveScope.style.animation).toBe("none");
    dispose();
    passiveScope.remove();
  });

  it("the diagnostic pin WINS: a pinned player drives even a hinted transition", () => {
    // The pin bypasses every automatic decision, including the takeover, so a
    // field debugger can force the player onto a heavy transition.
    pinnedSpy.mockReturnValue(true);
    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      ...baseInput(scope),
      midFlightCommitExpected: true
    });
    expect(scope.style.animation).toBe("none");
    dispose();
  });

  it("COMPLETED disarms the latch for the finished transition", () => {
    const latch = deps.midFlightCommitLatch!;
    const engine = createTransitionEngine(deps);

    const disposePush = engine.driveScreenLifecycle({
      ...baseInput(scope),
      midFlightCommitExpected: true
    });
    expect(latch.isArmed("task-1")).toBe(true);
    disposePush();

    engine.driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "takeover-test" as never,
      prevTransitionName: "takeover-test" as never,
      status: "COMPLETED",
      isActive: true,
      animHoldReleased: true
    });
    expect(latch.isArmed("task-1")).toBe(false);
  });

  it("does not leak across transitions: a later non-hinted task joins the player", () => {
    const latch = deps.midFlightCommitLatch!;
    // Transition A armed the latch and was interrupted (no COMPLETED disarm).
    latch.arm("task-A");

    // Transition B (task-1 per the deps) does NOT defer: its passive side reads
    // its OWN id, finds no arm, and joins the player as normal.
    const engine = createTransitionEngine(deps);
    const passiveScope = newScope();
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope: passiveScope }),
      transitionName: "takeover-test" as never,
      prevTransitionName: "takeover-test" as never,
      status: "PUSHING",
      isActive: false,
      animHoldReleased: true,
      midFlightCommitExpected: false
    });
    expect(passiveScope.style.animation).toBe("none");
    dispose();
    passiveScope.remove();
  });

  it("arms the compiled-CSS recovery on the declined active path (restart on cancel)", () => {
    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      ...baseInput(scope),
      midFlightCommitExpected: true
    });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    // The player declined, so the recovery umbrella is armed: a WebKit-style
    // mid-flight cancel restarts the compiled animation instead of dying.
    const cancel = new Event("animationcancel");
    Object.defineProperty(cancel, "animationName", {
      value: "flemo-screen-takeover-test-PUSHING-true"
    });
    scope.dispatchEvent(cancel as AnimationEvent);
    expect(removeSpy).toHaveBeenCalledWith("animation");

    removeSpy.mockRestore();
    dispose();
  });

  it("leaves the SKIP_ANIMATION (swipe-committed) path untouched under the hint", () => {
    // A swipe already animated the scope out: hasAnimation is false, so the
    // engine resolves in a microtask with no player, no CSS animation, and no
    // recovery — the shell-first gate never perturbs the skip path.
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      ...baseInput(scope),
      midFlightCommitExpected: true
    });
    expect(scope.style.animation).toBe("");
    dispose();
  });
});
