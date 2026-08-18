import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

import createTransition from "@transition/createTransition";
import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { reportInFlightCadence, resetSteadySixtyForTests } from "@core/engine/steadySixtyCadence";

import type { TransitionEngine, TransitionEngineDeps } from "@core/engine/types";

// The WARM side's image-only hold (see the holdsFlightImages block in
// createTransitionEngine): the leaving screen of a push and the leaving top
// of a pop are moving layers the arrival hold never covers, and an <img>
// still loading there would decode and first-raster mid-flight (glass-
// measured as one skipped present per decode). On steady-60 desktops the
// engine parks those UNPAINTED images for the flight and reveals them at
// rest; painted images are never touched.

const animated = createTransition({
  name: "img-hold-test" as never,
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.3 } },
  exit: { value: { x: "-30%" }, options: { duration: 0.3 } },
  exitBack: { value: { x: 0 }, options: { duration: 0.3 } }
});

const NAV = navigator as { userAgentData?: unknown };

const frames = (count: number) =>
  new Promise<void>((resolve) => {
    let remaining = count;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

describe("createTransitionEngine warm-side flight image hold", () => {
  let deps: TransitionEngineDeps;
  let scope: HTMLDivElement;
  let loadingImg: HTMLImageElement;
  let paintedImg: HTMLImageElement;
  let resolveSpy: ReturnType<typeof vi.spyOn>;
  let originalDpr: number;
  let disposers: (() => void)[];

  beforeEach(() => {
    transitionMap.set("img-hold-test" as never, animated);
    deps = {
      getTransitionTaskId: vi.fn(() => "task-img-hold"),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    };
    resolveSpy = vi.spyOn(TaskManger, "resolveTask").mockResolvedValue(true);
    scope = document.createElement("div");
    // A still-loading avatar (jsdom images are never complete) and a painted
    // one (complete with decoded dimensions).
    loadingImg = document.createElement("img");
    paintedImg = document.createElement("img");
    Object.defineProperty(paintedImg, "complete", { value: true, configurable: true });
    Object.defineProperty(paintedImg, "naturalWidth", { value: 44, configurable: true });
    Object.defineProperty(paintedImg, "naturalHeight", { value: 44, configurable: true });
    scope.append(loadingImg, paintedImg);
    document.body.appendChild(scope);
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    disposers = [];
  });

  afterEach(() => {
    for (const dispose of disposers) dispose();
    scope.remove();
    transitionMap.delete("img-hold-test" as never);
    resolveSpy.mockRestore();
    resetSteadySixtyForTests();
    window.sessionStorage.removeItem("flemo:imghold");
    delete NAV.userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
  });

  const verifySixty = () => {
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
  };

  const drive = (
    engine: TransitionEngine,
    status: "PUSHING" | "POPPING" | "COMPLETED",
    isActive: boolean
  ) => {
    const dispose = engine.driveScreenLifecycle({
      getElements: () => ({ scope }),
      transitionName: "img-hold-test" as never,
      prevTransitionName: "img-hold-test" as never,
      status,
      isActive,
      animHoldReleased: true
    });
    disposers.push(dispose);
  };

  it("parks the leaving push screen's unpainted images, never the painted ones", () => {
    verifySixty();
    const engine = createTransitionEngine(deps);
    drive(engine, "PUSHING", false);
    expect(loadingImg.style.display).toBe("none");
    expect(loadingImg.hasAttribute("data-flemo-img-hold")).toBe(true);
    expect(paintedImg.style.display).not.toBe("none");
  });

  it("parks the leaving top's unpainted images on pop", () => {
    verifySixty();
    const engine = createTransitionEngine(deps);
    drive(engine, "POPPING", true);
    expect(loadingImg.style.display).toBe("none");
  });

  it("reveals at rest through the landing scheduler", async () => {
    verifySixty();
    const engine = createTransitionEngine(deps);
    drive(engine, "PUSHING", false);
    expect(loadingImg.style.display).toBe("none");
    drive(engine, "COMPLETED", false);
    await frames(3);
    expect(loadingImg.style.display).not.toBe("none");
    expect(loadingImg.hasAttribute("data-flemo-img-hold")).toBe(false);
  });

  it("hands a warm→cold interrupt over without stranding the image", async () => {
    verifySixty();
    const engine = createTransitionEngine(deps);
    drive(engine, "PUSHING", false);
    expect(loadingImg.style.display).toBe("none");

    // A new flight claims this screen as the ARRIVING side before the first
    // one landed. The warm-side hold releases inside this same drive, AHEAD
    // of the arrival block — otherwise the arrival's own image hold captures
    // this hold's display:none as the "original" and restores it at rest,
    // stranding the image invisible forever.
    drive(engine, "POPPING", false);
    drive(engine, "COMPLETED", false);
    await frames(3);

    expect(loadingImg.style.display).not.toBe("none");
    expect(loadingImg.hasAttribute("data-flemo-img-hold")).toBe(false);
  });

  it("flemo:imghold=on holds the ARRIVING screen's images off the steady-60 profile", () => {
    // No steady-60 verdict here: the explicit override is the whole point —
    // it is the measurement instrument the default profile grew out of.
    window.sessionStorage.setItem("flemo:imghold", "on");
    const engine = createTransitionEngine(deps);
    drive(engine, "PUSHING", true);

    expect(loadingImg.style.display).toBe("none");
    expect(loadingImg.hasAttribute("data-flemo-img-hold")).toBe(true);
  });

  it("stays unarmed while the session is not steady-60 verified", () => {
    const engine = createTransitionEngine(deps);
    drive(engine, "PUSHING", false);
    expect(loadingImg.style.display).not.toBe("none");
  });

  it("flemo:imghold=off disables the warm-side hold too", () => {
    verifySixty();
    window.sessionStorage.setItem("flemo:imghold", "off");
    const engine = createTransitionEngine(deps);
    drive(engine, "PUSHING", false);
    expect(loadingImg.style.display).not.toBe("none");
  });
});
