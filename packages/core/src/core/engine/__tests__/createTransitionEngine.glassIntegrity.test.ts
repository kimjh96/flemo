import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import { QUARANTINE_ATTR, animationName } from "@transition/compileTransitionStyles";

import createTransitionEngine from "@core/engine/createTransitionEngine";

import type { TransitionEngineDeps } from "@core/engine/types";

// Engine wiring for the pose-preserving quarantine and the opening-clock
// guard. jsdom has no Web Animations API, so the quarantine takes its
// degraded path (attribute lifecycle only) unless a test stubs
// `scope.getAnimations`.

const landingFlush = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)))
  );

// The compositor-trail grace defers CLEAN non-Blink landings (see
// createTransitionEngine's COMPOSITOR_TRAIL_GRACE_MS); these suites assert
// the resolve-at-end contracts themselves, so they run as Blink
// (userAgentData present → grace 0). The dedicated trailGrace suite covers
// the non-Blink deferral.
beforeAll(() =>
  Object.defineProperty(navigator, "userAgentData", { configurable: true, value: {} })
);
afterAll(() => {
  delete (navigator as { userAgentData?: unknown }).userAgentData;
});

describe("animation quarantine wiring", () => {
  let deps: TransitionEngineDeps;
  let resolveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = {
      getTransitionTaskId: vi.fn(() => "task-glass"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
  });

  afterEach(() => {
    resolveSpy.mockRestore();
  });

  const drive = (
    engine: ReturnType<typeof createTransitionEngine>,
    scope: HTMLElement,
    input: Partial<Parameters<ReturnType<typeof createTransitionEngine>["driveScreenLifecycle"]>[0]>
  ) =>
    engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: false,
      ...input
    });

  it("stamps the cold entering screen at the mount drive and lifts it two frames past COMPLETED", async () => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    const engine = createTransitionEngine(deps);

    const cleanupMount = drive(engine, scope, { status: "REPLACING" });
    // The mount drive — BEFORE the anim-hold release — already quarantines:
    // the pose pins must be on glass from the screen's first frame.
    expect(scope.getAttribute(QUARANTINE_ATTR)).toBe("true");

    cleanupMount();
    const cleanupReleased = drive(engine, scope, { status: "REPLACING", animHoldReleased: true });
    expect(scope.getAttribute(QUARANTINE_ATTR)).toBe("true");

    cleanupReleased();
    const cleanupCompleted = drive(engine, scope, {
      status: "COMPLETED",
      animHoldReleased: true
    });
    // Not at the COMPLETED flip itself (the convergence frame's busiest
    // commit) — two frames later, with the arrival hold's landing.
    expect(scope.getAttribute(QUARANTINE_ATTR)).toBe("true");
    await landingFlush();
    expect(scope.hasAttribute(QUARANTINE_ATTR)).toBe(false);

    cleanupCompleted();
    scope.remove();
  });

  it("never quarantines a pop side or the warm exiting screen", () => {
    const engine = createTransitionEngine(deps);
    const popping = document.createElement("div");
    const exiting = document.createElement("div");
    document.body.append(popping, exiting);

    const cleanupPop = drive(engine, popping, { status: "POPPING", isActive: true });
    expect(popping.hasAttribute(QUARANTINE_ATTR)).toBe(false);
    const cleanupExit = drive(engine, exiting, { status: "REPLACING", isActive: false });
    expect(exiting.hasAttribute(QUARANTINE_ATTR)).toBe(false);

    cleanupPop();
    cleanupExit();
    popping.remove();
    exiting.remove();
  });

  it("a passive screen's mid-flight drive never releases the active side's quarantine", () => {
    const engine = createTransitionEngine(deps);
    const entering = document.createElement("div");
    const exiting = document.createElement("div");
    document.body.append(entering, exiting);

    const cleanupEnter = drive(engine, entering, { status: "REPLACING" });
    expect(entering.getAttribute(QUARANTINE_ATTR)).toBe("true");
    // The exiting screen's drive re-runs mid-flight (the anim-hold release
    // commit) while the slot is set — it must not land the quarantine.
    const cleanupExit = drive(engine, exiting, {
      status: "REPLACING",
      isActive: false,
      animHoldReleased: true
    });
    expect(entering.getAttribute(QUARANTINE_ATTR)).toBe("true");

    cleanupEnter();
    cleanupExit();
    entering.remove();
    exiting.remove();
  });

  it("an interrupt flipping the owner's role lands the quarantine immediately", () => {
    const engine = createTransitionEngine(deps);
    const scope = document.createElement("div");
    document.body.appendChild(scope);

    const cleanupPush = drive(engine, scope, { status: "PUSHING" });
    expect(scope.getAttribute(QUARANTINE_ATTR)).toBe("true");
    cleanupPush();
    // The same screen starts popping back out: warm side now — its consumer
    // animations must come back before the new flight's first frame.
    const cleanupPop = drive(engine, scope, { status: "POPPING" });
    expect(scope.hasAttribute(QUARANTINE_ATTR)).toBe(false);

    cleanupPop();
    scope.remove();
  });

  it("a stale slot whose owner unmounted is landed so the next cold screen can arm", () => {
    const engine = createTransitionEngine(deps);
    const doomed = document.createElement("div");
    document.body.appendChild(doomed);

    const cleanupDoomed = drive(engine, doomed, { status: "PUSHING" });
    expect(doomed.getAttribute(QUARANTINE_ATTR)).toBe("true");
    cleanupDoomed();
    doomed.remove();

    const fresh = document.createElement("div");
    document.body.appendChild(fresh);
    const cleanupFresh = drive(engine, fresh, { status: "PUSHING" });
    expect(fresh.getAttribute(QUARANTINE_ATTR)).toBe("true");

    cleanupFresh();
    fresh.remove();
  });
});

describe("opening clock guard wiring", () => {
  let deps: TransitionEngineDeps;
  let resolveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = {
      getTransitionTaskId: vi.fn(() => "task-opening"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
  });

  afterEach(() => {
    resolveSpy.mockRestore();
  });

  const screenAnimation = (currentTime: number) => {
    const animation = {
      animationName: animationName("screen", "cupertino", "PUSHING-true"),
      currentTime
    };
    return animation as unknown as Animation & { currentTime: number };
  };

  it("defers the perceptual cut by exactly the rewound span", () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
        "Date"
      ]
    });
    try {
      const scope = document.createElement("div");
      Object.defineProperty(scope, "clientWidth", { value: 390, configurable: true });
      Object.defineProperty(scope, "clientHeight", { value: 720, configurable: true });
      document.body.appendChild(scope);
      const animation = screenAnimation(217);
      Object.defineProperty(scope, "getAnimations", {
        configurable: true,
        value: (options?: { subtree?: boolean }) => (options?.subtree ? [] : [animation])
      });
      deps.getTransitionTaskId = vi.fn(() => "cut-rewind-task");
      const engine = createTransitionEngine(deps);
      const cleanup = engine.driveScreenLifecycle({
        getElements: () => ({ scope, decorator: null, bars: [] }),
        transitionName: "cupertino" as never,
        prevTransitionName: "cupertino" as never,
        status: "PUSHING",
        isActive: true,
        animHoldReleased: true
      });

      // Guard frame: 200ms of never-presented clock rewound to the one-frame
      // mark.
      vi.advanceTimersByTime(17);
      expect(animation.currentTime).toBe(17);

      // The un-deferred cut lands between 420ms and 620ms (see the plain cut
      // test); presentation is 200ms behind the wall now, so firing there
      // would truncate visible motion. The cut must re-defer.
      vi.advanceTimersByTime(600);
      expect(resolveSpy).not.toHaveBeenCalled();

      // ...and resolve once the deferred point (cut + 200ms) passes, still
      // before the re-armed watchdog (rewind + motion span + 250ms).
      vi.advanceTimersByTime(233);
      expect(resolveSpy).toHaveBeenCalledWith("cut-rewind-task");

      cleanup();
      scope.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancel-resume rejoins the PRESENTED timeline: the rewound span is excluded from elapsed", async () => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    const expectedName = animationName("screen", "cupertino", "PUSHING-true");
    const animation = screenAnimation(217);
    Object.defineProperty(scope, "getAnimations", {
      configurable: true,
      value: (options?: { subtree?: boolean }) => (options?.subtree ? [] : [animation])
    });
    deps.getTransitionTaskId = vi.fn(() => "resume-rewind-task");
    const engine = createTransitionEngine(deps);
    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    expect(animation.currentTime).toBe(17);

    // A WebKit cancel right after the correction. Wall elapsed since
    // animationstart is ~0ms but includes none of the 200ms rewind; without
    // the subtraction the resume would rejoin 200ms too FAR and skip the
    // opening all over again. With it, the rejoin delay is +0.2s — waiting
    // out the span the wall ran ahead of presentation.
    const startEvent = new Event("animationstart");
    Object.defineProperty(startEvent, "animationName", { value: expectedName });
    scope.dispatchEvent(startEvent);
    const cancelEvent = new Event("animationcancel");
    Object.defineProperty(cancelEvent, "animationName", { value: expectedName });
    scope.dispatchEvent(cancelEvent);

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(scope.style.animationDelay).toMatch(/^0\.(19|2)/);

    cleanup();
    scope.remove();
  });

  it("rewinds an eaten opening once, and never re-arms on a drive re-run", async () => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    const animation = screenAnimation(120);
    Object.defineProperty(scope, "getAnimations", {
      configurable: true,
      value: (options?: { subtree?: boolean }) => (options?.subtree ? [] : [animation])
    });
    const engine = createTransitionEngine(deps);

    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    // 120ms on the clock at the first frame = 103ms of never-presented
    // motion; the guard rewinds it to the one-frame mark.
    expect(animation.currentTime).toBe(17);

    // A drive re-run must not correct again — this motion has now presented.
    cleanup();
    animation.currentTime = 90;
    const cleanupRerun = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    expect(animation.currentTime).toBe(90);

    cleanupRerun();
    scope.remove();
  });
});
