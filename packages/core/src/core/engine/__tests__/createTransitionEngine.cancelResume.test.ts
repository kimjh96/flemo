import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeAll(() => localStorage.setItem("flemo:motion-driver-force", "raf"));
afterAll(() => localStorage.removeItem("flemo:motion-driver-force"));

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
const cancelEvent = (name: string) => {
  const event = new Event("animationcancel");
  Object.defineProperty(event, "animationName", { value: name });
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

    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE))); // original start = 1000

    nowSpy.mockReturnValue(1060); // elapsed 60ms of a 150ms span
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));

    // delay 0 - 60ms = -0.06s: the resume picks up 60ms into the motion.
    expect(scope.style.animationDelay).toBe("-0.06s");
    expect(resolveSpy).not.toHaveBeenCalled();

    dispose();
  });

  it("cancel during the delay phase waits out the remainder with a positive delay", () => {
    const scope = newDiv();
    const dispose = driveActive(scope, DELAYED);

    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(startEvent(ACTIVE(DELAYED)));

    nowSpy.mockReturnValue(1030); // 30ms into the 100ms delay phase
    scope.dispatchEvent(cancelEvent(ACTIVE(DELAYED)));

    // delay 0.1 - 0.03 = 0.07s remaining before the motion proper begins.
    expect(scope.style.animationDelay).toBe("0.07s");

    dispose();
  });

  it("cancel past delay+duration does not resume: active resolves, passive no-ops", () => {
    const active = newDiv();
    const disposeActive = driveActive(active);
    const activeRemove = vi.spyOn(active.style, "removeProperty");
    nowSpy.mockReturnValue(1000);
    active.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));
    nowSpy.mockReturnValue(1200); // elapsed 200ms > 150ms span → finished
    active.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    expect(activeRemove).not.toHaveBeenCalled(); // no restart
    expect(active.style.animationDelay).toBe(""); // no rejoin delay written
    expect(resolveSpy).toHaveBeenCalledWith("task-1"); // active concedes → resolve
    disposeActive();

    resolveSpy.mockClear();
    const passive = newDiv();
    const disposePassive = drivePassive(passive);
    const passiveRemove = vi.spyOn(passive.style, "removeProperty");
    nowSpy.mockReturnValue(2000);
    passive.dispatchEvent(startEvent(PASSIVE(CROSSFADE)));
    nowSpy.mockReturnValue(2200);
    passive.dispatchEvent(cancelEvent(PASSIVE(CROSSFADE)));
    expect(passiveRemove).not.toHaveBeenCalled(); // no restart
    expect(resolveSpy).not.toHaveBeenCalled(); // passive resolves nothing
    disposePassive();
  });

  // ── Original-clock integrity ──────────────────────────────────────────────

  it("a resume's fresh animationstart does not reset the original clock", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE))); // original = 1000

    nowSpy.mockReturnValue(1050);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE))); // resume, elapsed 50
    expect(scope.style.animationDelay).toBe("-0.05s");

    // The resumed animation (negative delay) fires a fresh animationstart. It
    // must NOT move the original clock.
    nowSpy.mockReturnValue(1055);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));

    // Second cancel: elapsed is measured from the FIRST start (1000), not 1055.
    nowSpy.mockReturnValue(1090);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    // 1090 - 1000 = 90ms → -0.09s. (A reset clock would have given -0.035s.)
    expect(scope.style.animationDelay).toBe("-0.09s");

    dispose();
  });

  // ── Repeated cancels + resolution ─────────────────────────────────────────

  it("N≤budget cancels all resume, and the animation's end resolves the task exactly once", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));

    for (const at of [1030, 1060, 1090]) {
      nowSpy.mockReturnValue(at);
      scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
      expect(resolveSpy).not.toHaveBeenCalled();
    }

    // The final resume ends on the ORIGINAL schedule; its animationend resolves.
    scope.dispatchEvent(endEvent(ACTIVE(CROSSFADE)));
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith("task-1");

    // A stray late cancel after the end does not resolve again.
    nowSpy.mockReturnValue(1200);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
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

  it("COMPLETED strips a leftover inline animation-delay", () => {
    const scope = newDiv();
    scope.style.animationDelay = "-0.05s";
    createTransitionEngine(deps).driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: CROSSFADE,
      prevTransitionName: CROSSFADE,
      status: "COMPLETED",
      isActive: true,
      animHoldReleased: true
    });
    expect(scope.style.animationDelay).toBe("");
  });

  it("the active resume budget is pruned on resolution — no growth across transitions", () => {
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

  it("an animationstart emitted mid-restart does not corrupt the original clock", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    // First cancel arrives before any observed start (plain restart path).
    // Mid-restart, the "compositor" emits a start — the guard must ignore it,
    // leaving the clock unset.
    injectDuringNextReflow(scope, () => {
      nowSpy.mockReturnValue(1500);
      scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));
    });
    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));

    // The genuine start after the restart sets the clock; a later cancel's
    // rejoin math must reference IT (2000), not the mid-restart event (1500).
    nowSpy.mockReturnValue(2000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));
    nowSpy.mockReturnValue(2060);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    expect(scope.style.animationDelay).toBe("-0.06s");
    expect(resolveSpy).not.toHaveBeenCalled();
    dispose();
  });

  it("an animationcancel emitted mid-restart is ignored, not treated as another loss", () => {
    const scope = newDiv();
    const dispose = driveActive(scope);

    nowSpy.mockReturnValue(1000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));

    // Spend three of the four resumes on genuine cancels.
    for (const at of [1010, 1020, 1030]) {
      nowSpy.mockReturnValue(at);
      scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    }

    // The fourth genuine cancel spends the last budget; the mid-restart cancel
    // it triggers must be swallowed — processed, it would read as a FIFTH loss
    // and resolve the task out from under the running animation.
    injectDuringNextReflow(scope, () => {
      scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    });
    nowSpy.mockReturnValue(1040);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));

    expect(scope.style.animationDelay).toBe("-0.04s"); // the 4th resume landed
    expect(resolveSpy).not.toHaveBeenCalled();
    dispose();
  });

  it("a bubbling animation event from a descendant (foreign target) is ignored", () => {
    const scope = newDiv();
    const child = document.createElement("div");
    scope.appendChild(child);
    const dispose = driveActive(scope);

    const bubbling = (type: string) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, "animationName", { value: ACTIVE(CROSSFADE) });
      return event as AnimationEvent;
    };

    // A child's start must not set the clock, and a child's cancel must not
    // trigger recovery, even with the expected animation name.
    nowSpy.mockReturnValue(1500);
    child.dispatchEvent(bubbling("animationstart"));
    child.dispatchEvent(bubbling("animationcancel"));
    expect(scope.style.animationDelay).toBe("");
    expect(resolveSpy).not.toHaveBeenCalled();

    // The scope's own start still records the clock cleanly afterwards.
    nowSpy.mockReturnValue(2000);
    scope.dispatchEvent(startEvent(ACTIVE(CROSSFADE)));
    nowSpy.mockReturnValue(2090);
    scope.dispatchEvent(cancelEvent(ACTIVE(CROSSFADE)));
    expect(scope.style.animationDelay).toBe("-0.09s");
    dispose();
  });
});
