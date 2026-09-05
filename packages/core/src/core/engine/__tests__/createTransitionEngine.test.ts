import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

import { trackInlineWrite } from "@transition/animateInline";
import createTransition from "@transition/createTransition";
import none from "@transition/none";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { resetFlightWindowForTests } from "@core/engine/flightWindow";
import { LAYER_SETTLE_MS } from "@core/engine/layerSettleHold";
import { SKIP_ANIMATION_ATTR, type TransitionEngineDeps } from "@core/engine/types";

// A transition whose enter variant actually animates (duration > 0), so
// `PUSHING-true` reports an animation and the engine waits for animationend.
// The mismatched clipPath templates ("inset(0 0 0 100%)" vs "inset(0)") make
// this variant non-player-drivable on purpose: these tests exercise the CSS
// animation path (animationend contract), which such variants keep.
const animated = createTransition({
  name: "engine-test" as never,
  initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const newDiv = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

const animationEndEvent = (name: string, elapsedTime = 0.3) => {
  const event = new Event("animationend");
  Object.defineProperty(event, "animationName", { value: name });
  Object.defineProperty(event, "elapsedTime", { value: elapsedTime });
  return event as AnimationEvent;
};

const animationCancelEvent = (name: string) => {
  const event = new Event("animationcancel");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};

describe("createTransitionEngine.driveScreenLifecycle", () => {
  let deps: TransitionEngineDeps;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let scope: HTMLDivElement;

  beforeEach(() => {
    transitionMap.set("engine-test" as never, animated);
    transitionMap.set("none", none);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-1"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManager, "resolveTask").mockResolvedValue(true);
    scope = newDiv();
  });

  afterEach(() => {
    scope.remove();
    transitionMap.delete("engine-test" as never);
    resolveSpy.mockRestore();
    vi.useRealTimers();
  });

  const drive = (
    overrides: Partial<
      Parameters<ReturnType<typeof createTransitionEngine>["driveScreenLifecycle"]>[0]
    > & {
      elements?: {
        scope: HTMLElement | null;
        decorator?: HTMLElement | null;
        bars?: (HTMLElement | null)[];
      };
    } = {}
  ) => {
    const engine = createTransitionEngine(deps);
    const { elements, ...rest } = overrides;
    return engine.driveScreenLifecycle({
      getElements: () => elements ?? { scope },
      transitionName: "engine-test" as never,
      prevTransitionName: "engine-test" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true,
      ...rest
    });
  };

  it("flips replace-transition status for a prev screen entering a differently-transitioned replace", () => {
    drive({
      isActive: false,
      status: "REPLACING",
      transitionName: "a" as never,
      prevTransitionName: "b" as never
    });
    expect(vi.mocked(deps.setReplaceTransitionStatus)).toHaveBeenCalledWith("PENDING");
  });

  it("does nothing for an inactive screen outside a differing replace", () => {
    drive({ isActive: false, status: "PUSHING" });
    expect(vi.mocked(deps.setReplaceTransitionStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(deps.setDragStatus)).not.toHaveBeenCalled();
  });

  it("resolves drag/replace and strips inline styles on COMPLETED", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const decorator = newDiv();
    const bar = newDiv();
    // A RIDING bar the engine promotes during the flight (the layer settle
    // hold only manages elements it stamped — a bare consumer will-change is
    // left untouched).
    bar.setAttribute("data-flemo-bar-riding", "true");

    // ONE engine instance drives both statuses (a screen keeps its engine for
    // its lifetime) — layer holds are per-instance, so the same instance's
    // COMPLETED must release the promotion its PUSHING stamped.
    const engine = createTransitionEngine(deps);
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator, bars: [bar] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    expect(bar.style.getPropertyValue("will-change")).toBe("transform");

    scope.style.transform = "translateX(20px)";
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    decorator.style.transform = "translateX(20px)";

    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator, bars: [bar] }),
      transitionName: "engine-test" as never,
      prevTransitionName: "engine-test" as never,
      status: "COMPLETED",
      isActive: true,
      animHoldReleased: true
    });

    expect(vi.mocked(deps.setDragStatus)).toHaveBeenCalledWith("IDLE");
    expect(vi.mocked(deps.setReplaceTransitionStatus)).toHaveBeenCalledWith("IDLE");
    expect(scope.style.transform).toBe("");
    expect(scope.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
    expect(decorator.style.transform).toBe("");
    // The bar's promoted layer demotes off-cadence, LAYER_SETTLE_MS past the
    // flip (see layerSettleHold.ts) — never in the flip commit itself.
    expect(bar.style.getPropertyValue("will-change")).toBe("transform");
    // jsdom + fake timers never run the landing's composed flight-window
    // release (it rides the real rAF clock) — close it as the landing does.
    resetFlightWindowForTests();
    vi.advanceTimersByTime(LAYER_SETTLE_MS);
    expect(bar.style.getPropertyValue("will-change")).toBe("");

    decorator.remove();
    bar.remove();
  });

  // REGRESSION (desktop player blank, 2026-08-17): at the COMPLETED flip the
  // player track's detach has already released its transform stake — restoring
  // the entering-initial from-pose the binding rendered — and DROPPED the
  // lease entry. With any OTHER lease still staked in that commit (the
  // governed easing stamp, released later by releaseParticipantLayers), the
  // force clear's keyed iteration never visited the now-untracked transform
  // and the empty-map fallback never ran: the landed screen stayed parked at
  // translate3d(100%) — a blank viewport. The COMPLETED branch now strips the
  // pose channels explicitly.
  it("strips a residual scope pose on COMPLETED even while another lease survives", () => {
    // Simulate the post-detach state: a stale restored pose on the scope…
    scope.style.transform = "translate3d(100%, 0px, 0px)";
    scope.style.opacity = "0";
    // …and a surviving lease on an unrelated property staked by another
    // writer, which keeps the lease map non-empty at the flip.
    trackInlineWrite(scope, "animation-timing-function", Symbol("other-writer"));
    scope.style.animationTimingFunction = "linear";

    drive({ status: "COMPLETED" });

    expect(scope.style.transform).toBe("");
    expect(scope.style.opacity).toBe("");
  });

  it("is a no-op on IDLE", () => {
    const dispose = drive({ status: "IDLE" });
    expect(vi.mocked(deps.setDragStatus)).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();
    dispose();
  });

  // The COMPLETED flip now waits for the last motion frame to PRESENT (two
  // rAFs past a clean end, 100ms fallback) — flush that before asserting.
  const presentedFlush = () =>
    new Promise((flushed) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(flushed, 0)))
        )
      )
    );

  it("resolves the task on the matching animationend and ignores others", async () => {
    const dispose = drive({ status: "PUSHING" });

    scope.dispatchEvent(animationEndEvent("some-other-animation"));
    expect(resolveSpy).not.toHaveBeenCalled();

    scope.dispatchEvent(animationEndEvent("flemo-screen-engine-test-PUSHING-true"));
    // A clean end resolves only after the presented-frame deferral.
    expect(resolveSpy).not.toHaveBeenCalled();
    await presentedFlush();
    expect(vi.mocked(deps.getTransitionTaskId)).toHaveBeenCalled();
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    dispose();
  });

  it("does not land a flight on an end that ran for no time", async () => {
    // `elapsedTime` is how long the animation actually ran. Zero means the
    // animation was torn down and rebuilt rather than finished — WebKit
    // reports that as an `animationend`, with the name, the keyframes and the
    // duration all still intact, so nothing else about the event tells the two
    // apart. Resolving on one commits the store move and flips the screen to
    // COMPLETED while the motion is still at its from-pose, which is a cut
    // where a transition was authored.
    const dispose = drive({ status: "PUSHING" });

    scope.dispatchEvent(animationEndEvent("flemo-screen-engine-test-PUSHING-true", 0));
    await presentedFlush();
    expect(resolveSpy).not.toHaveBeenCalled();

    // The end that really ran still lands it.
    scope.dispatchEvent(animationEndEvent("flemo-screen-engine-test-PUSHING-true", 0.3));
    await presentedFlush();
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    dispose();
  });

  it("lands a variant with no motion of its own on the end that reports no time", async () => {
    // The other side of the guard. `none` animates nothing, so its end
    // legitimately reports `elapsedTime: 0` — there was no time to report — and
    // a flight that refused it would wait out the watchdog on every screen that
    // authored no motion.
    const dispose = drive({
      status: "PUSHING",
      transitionName: "none",
      prevTransitionName: "none"
    });

    scope.dispatchEvent(animationEndEvent("flemo-screen-none-PUSHING-true", 0));
    await presentedFlush();
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    dispose();
  });

  it("anchors the task gate with the authored motion span (a long motion is never cut)", () => {
    const anchorSpy = vi.spyOn(TaskManager, "anchorGate").mockImplementation(() => {});
    const dispose = drive({ status: "PUSHING" });
    // engine-test: 0.3s active motion → anchored window = span + recovery margin.
    expect(anchorSpy).toHaveBeenCalledWith("task-1", 300 + 1500);
    anchorSpy.mockRestore();
    dispose();
  });

  it("resolves on a microtask when the variant has no animation (skip flag)", async () => {
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    drive({ status: "PUSHING" });
    expect(resolveSpy).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(resolveSpy).toHaveBeenCalledWith("task-1");
  });

  it("the liveness floor resolves the captured task when nothing else ever fires", () => {
    vi.useFakeTimers();
    const dispose = drive({ status: "PUSHING" });
    expect(resolveSpy).not.toHaveBeenCalled();

    // settleMs = (delay 0 + duration 0.3) * 1000 + the 1500ms margin.
    vi.advanceTimersByTime(1800);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");
    dispose();
  });

  it("disposer detaches the animationend listener", () => {
    const dispose = drive({ status: "PUSHING" });
    dispose();
    scope.dispatchEvent(animationEndEvent("flemo-screen-engine-test-PUSHING-true"));
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  // ── Part 2: animation-signal loss recovery (compiled-CSS path) ────────────
  // The `animated` transition (mismatched clipPath templates, no WAAPI in
  // jsdom) always takes the compiled-CSS path, so the engine wires the
  // animationcancel + watchdog recovery here. `flemo-screen-engine-test-…` is
  // the compiled screen animation name (see animationName()).
  const SCREEN_ANIM = "flemo-screen-engine-test-PUSHING-true";

  it("restarts a cancelled screen animation once, then resolves on the restart's animationend", async () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    // A data/suspense commit cancels the animation mid-flight; no animationend
    // ever comes for it. The engine restarts it rather than resolve early.
    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));
    expect(removeSpy).toHaveBeenCalledWith("animation"); // restart trick ran
    expect(scope.style.animation).toBe(""); // left the compiled rule live again
    expect(resolveSpy).not.toHaveBeenCalled(); // restarted, did NOT resolve

    // The restarted animation ends normally → the task resolves (after the
    // presented-frame deferral).
    scope.dispatchEvent(animationEndEvent(SCREEN_ANIM));
    await presentedFlush();
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    removeSpy.mockRestore();
    dispose();
  });

  it("resumes up to the budget, then resolves when cancelled once more", () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    // With no animationstart observed, each cancel is a plain restart (no
    // rejoin delay). The budget is 4 resumes per task; every one restarts and
    // none resolves.
    for (let i = 0; i < 4; i++) {
      scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));
      expect(resolveSpy).not.toHaveBeenCalled();
    }
    expect(removeSpy).toHaveBeenCalledTimes(4); // 4 restart tricks
    expect(removeSpy).toHaveBeenCalledWith("animation");

    // The 5th cancel finds the budget spent → resolve rather than restart again.
    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));
    expect(removeSpy).toHaveBeenCalledTimes(4); // no fifth restart
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    removeSpy.mockRestore();
    dispose();
  });

  it("ignores animationcancel from other elements / other animation names", () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    scope.dispatchEvent(animationCancelEvent("some-other-animation"));
    const child = document.createElement("div");
    scope.appendChild(child);
    const bubbling = new Event("animationcancel", { bubbles: true });
    Object.defineProperty(bubbling, "animationName", { value: SCREEN_ANIM });
    child.dispatchEvent(bubbling);

    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
  });

  it("watchdog restarts once at duration+delay+250ms, then resolves at the next deadline", () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = drive({ status: "PUSHING" });

    // Deadline = (delay 0 + duration 0.3) * 1000 + 250 = 550ms.
    vi.advanceTimersByTime(549);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // 550 → first watchdog: restart + re-arm
    expect(removeSpy).toHaveBeenCalledWith("animation");
    expect(resolveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(549);
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); // 1100 → second watchdog: budget spent → resolve
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    removeSpy.mockRestore();
    dispose();
  });

  it("arms no watchdog while the anim-hold is unreleased (a paused animation is not lost)", () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = drive({ status: "PUSHING", animHoldReleased: false });

    // Past the watchdog deadline (550ms) but before the liveness floor
    // (1800ms): a held, paused animation must be neither restarted nor resolved.
    vi.advanceTimersByTime(1000);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
  });

  it("clears the watchdog on a normal animationend (no restart, no double-resolve)", () => {
    vi.useFakeTimers();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = drive({ status: "PUSHING" });

    vi.advanceTimersByTime(200);
    scope.dispatchEvent(animationEndEvent(SCREEN_ANIM));
    // Presented-frame deferral: the resolve lands via its rAF chain/fallback.
    vi.advanceTimersByTime(132);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    // Past the watchdog deadline + its would-be re-arm, but before the 1800ms
    // floor: the cleared watchdog neither restarts nor resolves a second time.
    vi.advanceTimersByTime(1300); // total 1500ms
    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    removeSpy.mockRestore();
    dispose();
  });

  it("the presented-frame deferral falls back to its timeout when frames never come", () => {
    vi.useFakeTimers();
    // A backgrounded tab: rAF is suspended, so only the 100ms fallback can
    // land the deferred resolve.
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const dispose = drive({ status: "PUSHING" });

    scope.dispatchEvent(animationEndEvent(SCREEN_ANIM));
    expect(resolveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    dispose();
    vi.unstubAllGlobals();
  });

  it("does not double-arm the watchdog when the anim-hold release re-runs the effect", () => {
    vi.useFakeTimers();
    const engine = createTransitionEngine(deps);
    const input = (animHoldReleased: boolean) => ({
      getElements: () => ({ scope }),
      transitionName: "engine-test" as never,
      prevTransitionName: "engine-test" as never,
      status: "PUSHING" as const,
      isActive: true,
      animHoldReleased
    });

    // Held run arms nothing; React then re-runs the effect on release: the held
    // run's cleanup fires first, so the released run arms exactly ONE watchdog.
    const disposeHeld = engine.driveScreenLifecycle(input(false));
    disposeHeld();
    const disposeReleased = engine.driveScreenLifecycle(input(true));

    // One watchdog: restart at 550, resolve at 1100. A double-arm would spend
    // the budget in the same tick and resolve at 550 instead.
    vi.advanceTimersByTime(550);
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(550);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    disposeReleased();
  });

  it("does not restart when SKIP_ANIMATION is set mid-flight; resolves immediately", () => {
    const dispose = drive({ status: "PUSHING" });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");

    // A swipe commits the exit and marks the scope skip-animation after setup.
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));

    expect(removeSpy).not.toHaveBeenCalled(); // no restart trick
    expect(resolveSpy).toHaveBeenCalledWith("task-1"); // resolved immediately

    removeSpy.mockRestore();
    dispose();
  });

  it("recovery is a no-op when there is no transition task id to gate", () => {
    const engine = createTransitionEngine({
      getTransitionTaskId: () => null,
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    });
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "engine-test" as never,
      prevTransitionName: "engine-test" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });

    scope.dispatchEvent(animationCancelEvent(SCREEN_ANIM));
    expect(removeSpy).not.toHaveBeenCalled(); // nothing to restart
    expect(resolveSpy).not.toHaveBeenCalled(); // nothing to resolve

    removeSpy.mockRestore();
    dispose();
  });
});
