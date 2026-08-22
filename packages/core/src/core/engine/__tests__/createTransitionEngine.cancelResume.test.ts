import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import { animationName } from "@transition/compileTransitionStyles";
import createTransition from "@transition/createTransition";

import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { SKIP_ANIMATION_ATTR, type TransitionEngineDeps } from "@core/engine/types";
import createPartTransition from "@transition/partTransition/createPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// ─────────────────────────────────────────────────────────────────────────────
// Cancel-resume liveness: a browser-cancelled compiled-CSS animation is resumed
// on its ORIGINAL timeline (negative-delay rejoin), on every participant, until
// a bounded budget. These suites exercise the resume math, the original-clock
// integrity, the watchdog's independence from resumes, participant coverage,
// cleanup, and the bookkeeping's boundedness.
//
// Force the driver to "raf" so the policy gate is on; the mismatched-clipPath
// variants below still take the compiled-CSS path (no WAAPI in jsdom), which is
// exactly the path this recovery guards.
// ─────────────────────────────────────────────────────────────────────────────

// delay 0, duration 0.15 → span 150ms, watchdog deadline 400ms. Mismatched
// clipPath templates ("inset(0)" vs "inset(0 0 0 100%)") keep both sides on the
// compiled-CSS path.
const CROSSFADE = "cr-fade" as never;
const crossfade = createTransition({
  name: CROSSFADE,
  initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
  idle: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0 } },
  enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.15 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.15 } },
  exit: { value: { x: "-1%", clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.15 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.15 } }
});

// delay 0.1, duration 0.15 → span 250ms; the delay phase lets us test a
// cancel-during-delay resume (positive remaining inline delay).
const DELAYED = "cr-delayed" as never;
const delayed = createTransition({
  name: DELAYED,
  initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
  idle: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0 } },
  enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.15, delay: 0.1 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.15 } },
  exit: { value: { x: "-1%", clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.15 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.15 } }
});

// A decorator+part transition on the CSS path (mismatched screen clipPath), for
// the participant-coverage suite.
const WITH_PARTS = "cr-parts" as never;
const withParts = createTransition({
  name: WITH_PARTS,
  initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
  idle: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0 } },
  enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.15 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.15 } },
  exit: { value: { x: "-1%", clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.15 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.15 } },
  options: { decoratorName: "overlay" }
});
const PART = "cr-part" as never;
const partTransition = createPartTransition({
  name: PART,
  initial: { opacity: 1 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 0 }, options: { duration: 0.15 } },
  exit: { value: { opacity: 1 }, options: { duration: 0.15 } }
});

const ACTIVE = (name: string) => animationName("screen", name, "REPLACING-true");
const PASSIVE = (name: string) => animationName("screen", name, "REPLACING-false");

const newDiv = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};
const startEvent = (name: string) => {
  const event = new Event("animationstart");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};
// animationcancel carries `elapsedTime` = the ACTIVE-phase seconds elapsed at
// cancel (CSS spec: excludes delay; 0 while still delaying). The resume math
// reads it directly, so tests pass the active-elapsed here.
const cancelEvent = (name: string, elapsedSeconds = 0) => {
  const event = new Event("animationcancel");
  Object.defineProperty(event, "animationName", { value: name });
  Object.defineProperty(event, "elapsedTime", { value: elapsedSeconds });
  return event as AnimationEvent;
};
const endEvent = (name: string) => {
  const event = new Event("animationend");
  Object.defineProperty(event, "animationName", { value: name });
  return event as AnimationEvent;
};

describe("createTransitionEngine cancel-resume liveness", () => {
  let deps: TransitionEngineDeps;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let nowSpy: ReturnType<typeof vi.spyOn>;
  let taskId: string | null;

  beforeEach(() => {
    transitionMap.set(CROSSFADE, crossfade);
    transitionMap.set(DELAYED, delayed);
    transitionMap.set(WITH_PARTS, withParts);
    partTransitionMap.set(PART, partTransition);
    taskId = "task-1";
    deps = {
      getTransitionTaskId: vi.fn(() => taskId),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    nowSpy = vi.spyOn(performance, "now");
  });

  afterEach(() => {
    transitionMap.delete(CROSSFADE);
    transitionMap.delete(DELAYED);
    transitionMap.delete(WITH_PARTS);
    partTransitionMap.delete(PART);
    resolveSpy.mockRestore();
    nowSpy.mockRestore();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const driveActive = (scope: HTMLElement, name = CROSSFADE) =>
    createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: name,
      prevTransitionName: name,
      status: "REPLACING",
      isActive: true,
      animHoldReleased: true
    });

  const drivePassive = (scope: HTMLElement, name = CROSSFADE) =>
    createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: name,
      prevTransitionName: name,
      status: "REPLACING",
      isActive: false,
      animHoldReleased: true
    });

  // ── Resume math ─────────────────────────────────────────────────────────

  it("cancel mid-flight rejoins the clock with a negative inline animation-delay", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    // Cancelled 60ms into the 150ms active phase (delay 0).
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.06));

    // -0.06s: the resume picks up 60ms into the motion.
    expect(scope.style.animationDelay).toBe("-0.06s");
    expect(resolveSpy).not.toHaveBeenCalled();

    dispose();
  });

  it("cancel DURING the delay phase replays from the top (no rejoin delay)", () => {
    const scope = newDiv();
    const dispose = driveActive(scope, DELAYED);

    // Cancelled while still delaying → animationcancel.elapsedTime is 0. The
    // active phase never presented, so the resume is a plain restart: the
    // authored delay replays, and NO rejoin delay is written (the old math
    // wrote a positive +0.07s that re-waited part of the delay).
    scope.dispatchEvent(cancelEvent(ACTIVE(DELAYED), 0));
    expect(scope.style.animationDelay).toBe("");

    dispose();
  });

  it("cancel in the ACTIVE phase of a DELAYED transition resumes with a negative delay only", () => {
    const scope = newDiv();
    const dispose = driveActive(scope, DELAYED);

    // 30ms into the active phase (the 100ms authored delay already consumed by
    // the browser). Resume must NOT re-add the delay: -0.03s, not +0.07s.
    scope.dispatchEvent(cancelEvent(ACTIVE(DELAYED), 0.03));
    expect(scope.style.animationDelay).toBe("-0.03s");

    dispose();
  });

  it("cancel past the active duration does not resume: active resolves, passive no-ops", () => {
    const active = newDiv();
    const disposeActive = driveActive(active);
    const activeRemove = vi.spyOn(active.style, "removeProperty");
    // 200ms > the 150ms active duration → finished, nothing to resume.
    active.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.2));
    expect(activeRemove).not.toHaveBeenCalled(); // no restart
    expect(active.style.animationDelay).toBe(""); // no rejoin delay written
    expect(resolveSpy).toHaveBeenCalledWith("task-1"); // active concedes → resolve
    disposeActive();

    resolveSpy.mockClear();
    const passive = newDiv();
    const disposePassive = drivePassive(passive);
    const passiveRemove = vi.spyOn(passive.style, "removeProperty");
    passive.dispatchEvent(cancelEvent(PASSIVE(CROSSFADE), 0.2));
    expect(passiveRemove).not.toHaveBeenCalled(); // no restart
    expect(resolveSpy).not.toHaveBeenCalled(); // passive resolves nothing
    disposePassive();
  });

  // ── Chained resumes ───────────────────────────────────────────────────────

  it("consecutive cancels resume from the accumulated active elapsed", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    // First cancel at active 50ms → -0.05s.
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.05));
    expect(scope.style.animationDelay).toBe("-0.05s");

    // The resumed animation's own animationcancel reports the TOTAL active
    // elapsed (it includes the negative rejoin delay). At 90ms total → -0.09s.
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.09));
    expect(scope.style.animationDelay).toBe("-0.09s");

    dispose();
  });

  // ── Repeated cancels + resolution ─────────────────────────────────────────

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

  it("N≤budget cancels all resume, and the animation's end resolves the task exactly once", async () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    for (const activeSeconds of [0.03, 0.06, 0.09]) {
      scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), activeSeconds));
      expect(resolveSpy).not.toHaveBeenCalled();
    }

    // The final resume ends on the ORIGINAL schedule; its animationend
    // resolves after the presented-frame deferral.
    scope.dispatchEvent(endEvent(ACTIVE(CROSSFADE)));
    await presentedFlush();
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    // A stray late cancel after the end does not resolve again.
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.2));
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    dispose();
  });

  // ── Watchdog independence ─────────────────────────────────────────────────

  it("a cancel-resume does NOT extend the watchdog: it fires on the original deadline", () => {
    vi.useFakeTimers();
    const scope = newDiv();
    const dispose = driveActive(scope);

    // Deadline = span 150 + 250 = 400ms; re-arm window another 400ms.
    vi.advanceTimersByTime(399);
    // A mid-flight cancel (no animationstart observed → plain restart) resumes
    // but MUST NOT re-arm the watchdog.
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    expect(resolveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // 400ms: first watchdog fire → full-restart, re-arm
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(399); // 799ms
    expect(resolveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); // 800ms: second watchdog → resolve on ORIGINAL schedule
    expect(resolveSpy).toHaveBeenCalledWith("task-1");
    // Had the cancel at 399 re-armed, the resolve would have slipped to 1199ms.

    dispose();
  });

  it("the watchdog still fires when the animation end is lost entirely", () => {
    vi.useFakeTimers();
    const scope = newDiv();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = driveActive(scope);

    // Nothing ever ends (no cancel, no animationend). First deadline restarts.
    vi.advanceTimersByTime(400);
    expect(removeSpy).toHaveBeenCalledWith("animation");
    expect(resolveSpy).not.toHaveBeenCalled();
    // Second deadline resolves.
    vi.advanceTimersByTime(400);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    removeSpy.mockRestore();
    dispose();
  });

  // ── Passive participants ──────────────────────────────────────────────────

  it("passive scope, decorator, riding bar, and part each recover; non-riding/null/ghost are skipped", () => {
    const container = newDiv();
    const scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "true");
    const decorator = document.createElement("div");
    const bar = document.createElement("div");
    bar.setAttribute("data-flemo-bar-riding", "true");
    const staticBar = document.createElement("div"); // not riding → skipped
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", PART);
    part.setAttribute("data-flemo-status", "REPLACING");
    part.setAttribute("data-flemo-active", "false");
    const ghostPart = document.createElement("div"); // no registered def → skipped
    ghostPart.setAttribute("data-flemo-part-name", "cr-ghost");
    ghostPart.setAttribute("data-flemo-status", "REPLACING");
    ghostPart.setAttribute("data-flemo-active", "false");
    container.append(scope, decorator, bar, staticBar, part, ghostPart);

    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator, bars: [bar, staticBar, null] }),
      transitionName: WITH_PARTS,
      prevTransitionName: WITH_PARTS,
      status: "REPLACING",
      isActive: false,
      animHoldReleased: true
    });

    const remove = (el: HTMLElement) => vi.spyOn(el.style, "removeProperty");
    const spies = {
      scope: remove(scope),
      decorator: remove(decorator),
      bar: remove(bar),
      staticBar: remove(staticBar),
      part: remove(part),
      ghostPart: remove(ghostPart)
    };

    scope.dispatchEvent(cancelEvent(PASSIVE(WITH_PARTS)));
    // The bar rides the SCREEN keyframes → same animation name as the scope.
    bar.dispatchEvent(cancelEvent(PASSIVE(WITH_PARTS)));
    staticBar.dispatchEvent(cancelEvent(PASSIVE(WITH_PARTS)));
    decorator.dispatchEvent(cancelEvent(animationName("decorator", "overlay", "REPLACING-false")));
    part.dispatchEvent(cancelEvent(animationName("part", PART, "REPLACING-false")));
    ghostPart.dispatchEvent(cancelEvent(animationName("part", "cr-ghost", "REPLACING-false")));

    expect(spies.scope).toHaveBeenCalledWith("animation");
    expect(spies.decorator).toHaveBeenCalledWith("animation");
    expect(spies.bar).toHaveBeenCalledWith("animation");
    expect(spies.part).toHaveBeenCalledWith("animation");
    // A non-riding bar and an unregistered part were never wired.
    expect(spies.staticBar).not.toHaveBeenCalled();
    expect(spies.ghostPart).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled(); // passive resolves nothing

    Object.values(spies).forEach((s) => s.mockRestore());
    dispose();
  });

  it("the active screen's riding bar recovers too, and teardown detaches it", () => {
    // On the ACTIVE (entering) side the riding bar mirrors the screen keyframes
    // (which animate on -true); the overlay decorator and the part are
    // motionless on -true (the dim/part ride the screen going behind), so only
    // the bar is a live participant here.
    const container = newDiv();
    const scope = document.createElement("div");
    scope.setAttribute("data-flemo-screen", "true");
    const bar = document.createElement("div");
    bar.setAttribute("data-flemo-bar-riding", "true");
    container.append(scope, bar);

    const engine = createTransitionEngine(deps);
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope, bars: [bar] }),
      transitionName: WITH_PARTS,
      prevTransitionName: WITH_PARTS,
      status: "REPLACING",
      isActive: true,
      animHoldReleased: true
    });

    const barRemove = vi.spyOn(bar.style, "removeProperty");
    bar.dispatchEvent(cancelEvent(ACTIVE(WITH_PARTS)));
    expect(barRemove).toHaveBeenCalledWith("animation");

    // Teardown detaches the participant: a later cancel does nothing.
    dispose();
    barRemove.mockClear();
    bar.dispatchEvent(cancelEvent(ACTIVE(WITH_PARTS)));
    expect(barRemove).not.toHaveBeenCalled();

    barRemove.mockRestore();
  });

  it("skips a decorator whose definition resolves no motion", () => {
    const NODECO = "cr-nodeco" as never;
    transitionMap.set(
      NODECO,
      createTransition({
        name: NODECO,
        initial: { x: "100%", clipPath: "inset(0 0 0 100%)" },
        idle: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0 } },
        enter: { value: { x: 0, clipPath: "inset(0)" }, options: { duration: 0.15 } },
        enterBack: { value: { x: "100%" }, options: { duration: 0.15 } },
        exit: { value: { x: "-1%", clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.15 } },
        exitBack: { value: { x: 0 }, options: { duration: 0.15 } },
        // A decoratorName not present in decoratorMap → no motion to wire.
        options: { decoratorName: "cr-unregistered" as never }
      })
    );
    const scope = newDiv();
    const decorator = newDiv();
    const decoRemove = vi.spyOn(decorator.style, "removeProperty");
    const dispose = createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope, decorator }),
      transitionName: NODECO,
      prevTransitionName: NODECO,
      status: "REPLACING",
      isActive: false,
      animHoldReleased: true
    });
    decorator.dispatchEvent(
      cancelEvent(animationName("decorator", "cr-unregistered", "REPLACING-false"))
    );
    expect(decoRemove).not.toHaveBeenCalled(); // decorator never wired
    decoRemove.mockRestore();
    dispose();
    transitionMap.delete(NODECO);
  });

  it("ignores a cancel whose animationName is not the participant's own", () => {
    const scope = newDiv();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = driveActive(scope);

    // A foreign name (e.g. the decorator's) on the scope must be ignored.
    scope.dispatchEvent(cancelEvent(animationName("decorator", "overlay", "REPLACING-true")));
    scope.dispatchEvent(cancelEvent("some-other-animation"));
    expect(removeSpy).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();

    removeSpy.mockRestore();
    dispose();
  });

  // ── Cleanup + bookkeeping boundedness ─────────────────────────────────────

  it("restores the consumer's own delay after the recovery overwrote it", () => {
    const scope = newDiv();
    // A consumer authored its own delay on the same element.
    scope.style.animationDelay = "0.2s";

    // Drive a flight and cancel 50ms into the active phase so the recovery
    // leases the consumer's 0.2s, then writes its negative rejoin delay.
    const dispose = driveActive(scope);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.05));
    expect(scope.style.animationDelay).toBe("-0.05s"); // recovery's rejoin
    // Interrupt: the controller detaches — it must restore the delay to the
    // consumer's original, not leave the stale rejoin for the next transition.
    dispose();
    expect(scope.style.animationDelay).toBe("0.2s");
  });

  it("an interrupted recovery does not bleed its rejoin delay into the next transition", () => {
    const scope = newDiv();
    // No consumer delay this time: the element starts clean.
    const dispose = driveActive(scope);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.05));
    expect(scope.style.animationDelay).toBe("-0.05s");
    // A NEW transition supersedes it (the effect disposer runs on interrupt).
    dispose();
    expect(scope.style.animationDelay).toBe(""); // no stale offset inherited
  });

  it("COMPLETED leaves a consumer's inline animation longhands untouched", () => {
    const scope = newDiv();
    // Consumer values flemo never wrote (no flight touched these longhands).
    scope.style.animationDelay = "0.3s";
    scope.style.animationTimingFunction = "steps(4)";
    createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: CROSSFADE,
      prevTransitionName: CROSSFADE,
      status: "COMPLETED",
      isActive: true,
      animHoldReleased: true
    });
    expect(scope.style.animationDelay).toBe("0.3s");
    expect(scope.style.animationTimingFunction).toBe("steps(4)");
  });

  it("the active resume budget is pruned on resolution — no growth across transitions", async () => {
    const engine = createTransitionEngine(deps);
    const scope = newDiv();

    for (let i = 0; i < 5; i++) {
      taskId = `task-${i}`;
      const dispose = engine.driveScreenLifecycle({
        getElements: () => ({ scope }),
        transitionName: CROSSFADE,
        prevTransitionName: CROSSFADE,
        status: "REPLACING",
        isActive: true,
        animHoldReleased: true
      });
      nowSpy.mockReturnValue(1000 + i * 1000);
      scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));
      nowSpy.mockReturnValue(1050 + i * 1000);
      scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE))); // adds a budget entry
      expect(engine.activeResumeEntryCount()).toBe(1);
      scope.dispatchEvent(endEvent(ACTIVE(CROSSFADE))); // resolve → prune entry
      await presentedFlush();
      expect(engine.activeResumeEntryCount()).toBe(0);
      dispose();
    }
    expect(engine.activeResumeEntryCount()).toBe(0);
  });

  it("a superseded transition's budget entry is pruned on stale teardown", () => {
    const engine = createTransitionEngine(deps);
    const scope = newDiv();
    taskId = "task-A";
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: CROSSFADE,
      prevTransitionName: CROSSFADE,
      status: "REPLACING",
      isActive: true,
      animHoldReleased: true
    });
    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));
    nowSpy.mockReturnValue(1050);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE))); // budget entry for task-A
    expect(engine.activeResumeEntryCount()).toBe(1);

    // A newer transition takes over; tearing down the old drive prunes the
    // stale entry (its task is no longer current).
    taskId = "task-B";
    dispose();
    expect(engine.activeResumeEntryCount()).toBe(0);
  });

  it("a swipe-committed (SKIP_ANIMATION) scope does not resume: it concedes", () => {
    const scope = newDiv();
    const removeSpy = vi.spyOn(scope.style, "removeProperty");
    const dispose = driveActive(scope);
    scope.setAttribute(SKIP_ANIMATION_ATTR, "true");
    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));
    nowSpy.mockReturnValue(1050);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    expect(removeSpy).not.toHaveBeenCalled(); // no restart
    expect(resolveSpy).toHaveBeenCalledWith("task-1"); // conceded
    removeSpy.mockRestore();
    dispose();
  });

  // ── Re-entrancy: synchronous compositor events mid-restart ───────────────
  // A real compositor may emit animation events SYNCHRONOUSLY while the
  // restart trick mutates the element (the reflow read is a style flush).
  // jsdom never does this on its own, so these tests inject the events from an
  // `offsetWidth` getter override — firing exactly inside the mutation window
  // the `midRestart` guard protects.

  // Fires `inject` synchronously from the restart trick's reflow read, once.
  const injectDuringNextReflow = (element: HTMLElement, inject: () => void) => {
    let fired = false;
    Object.defineProperty(element, "offsetWidth", {
      configurable: true,
      get() {
        if (!fired) {
          fired = true;
          inject();
        }
        return 0;
      }
    });
  };

  it("an animationcancel emitted mid-restart is ignored, not treated as another loss", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    // Spend three of the four resumes on genuine cancels (active 10/20/30ms).
    for (const activeSeconds of [0.01, 0.02, 0.03]) {
      scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), activeSeconds));
    }

    // The fourth genuine cancel spends the last budget; the mid-restart cancel
    // it triggers (during the drop-reflow-restore) must be swallowed by the
    // midRestart guard — processed, it would read as a FIFTH loss and resolve
    // the task out from under the running animation.
    injectDuringNextReflow(scope, () => {
      scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.04));
    });
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.04));

    expect(scope.style.animationDelay).toBe("-0.04s"); // the 4th resume landed
    expect(resolveSpy).not.toHaveBeenCalled();
    dispose();
  });

  it("a bubbling animationcancel from a descendant (foreign target) is ignored", () => {
    const scope = newDiv();
    const child = document.createElement("div");
    scope.appendChild(child);
    const dispose = driveActive(scope);

    // A child's cancel must not trigger recovery, even with the expected name.
    const bubblingCancel = new Event("animationcancel", { bubbles: true });
    Object.defineProperty(bubblingCancel, "animationName", { value: ACTIVE(CROSSFADE) });
    Object.defineProperty(bubblingCancel, "elapsedTime", { value: 0.05 });
    child.dispatchEvent(bubblingCancel);
    expect(scope.style.animationDelay).toBe("");
    expect(resolveSpy).not.toHaveBeenCalled();

    // The scope's own cancel still resumes cleanly afterwards.
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE), 0.09));
    expect(scope.style.animationDelay).toBe("-0.09s");
    dispose();
  });
});
