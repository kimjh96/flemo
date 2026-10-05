import { afterEach, describe, expect, it } from "vitest";

import { attachTransitionRecorder } from "../recorder";

import type { TransitionRecorderHandle } from "../types";

const frame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const frames = async (count: number) => {
  for (let index = 0; index < count; index += 1) await frame();
};

// Mutation delivery is a microtask; a macrotask hop makes it deterministic.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let handle: TransitionRecorderHandle | null = null;

const attach = (options?: Parameters<typeof attachTransitionRecorder>[0]) => {
  handle = attachTransitionRecorder(options);
  return handle;
};

afterEach(() => {
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
  sessionStorage.clear();
  localStorage.clear();
  delete (window as unknown as { flemo?: unknown }).flemo;
});

const mountScreen = () => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", "IDLE");
  screen.setAttribute("data-flemo-active", "false");
  screen.setAttribute("data-flemo-router", "test-router");
  document.body.appendChild(screen);
  return screen;
};

describe("attachTransitionRecorder", () => {
  it("is idempotent while attached and re-attachable after detach", () => {
    const first = attach();
    expect(attachTransitionRecorder()).toBe(first);
    first.detach();
    const second = attach();
    expect(second).not.toBe(first);
  });

  it("installs window.flemo and removes it on detach", () => {
    attach();
    const globalApi = (window as unknown as { flemo?: { report?: unknown } }).flemo;
    expect(typeof globalApi?.report).toBe("function");
    handle?.detach();
    expect((window as unknown as { flemo?: unknown }).flemo).toBeUndefined();
  });

  it("never overwrites a foreign window.flemo", () => {
    const foreign = { theirs: true };
    (window as unknown as { flemo: unknown }).flemo = foreign;
    const recorder = attach();
    expect((window as unknown as { flemo: unknown }).flemo).toBe(foreign);
    // The handle still works without the global.
    expect(recorder.report().version).toBe("4");
    recorder.detach();
    expect((window as unknown as { flemo: unknown }).flemo).toBe(foreign);
  });

  it("respects installGlobal: false", () => {
    attach({ installGlobal: false });
    expect((window as unknown as { flemo?: unknown }).flemo).toBeUndefined();
  });

  it("produces a JSON-serializable, self-describing report shape", () => {
    const recorder = attach();
    const report = recorder.report();
    expect(report.version).toBe("4");
    expect(report.blindSpots.length).toBeGreaterThanOrEqual(4);
    expect(report.transitions).toEqual([]);
    expect(report.overrides).toEqual({ active: {}, warnings: [] });
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it("records a PUSH transition from data-flemo-status attribute flips", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(3);

    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3); // landing audit runs 2 rAF after completion

    const report = handle!.report();
    expect(report.transitions).toHaveLength(1);
    const transition = report.transitions[0];
    expect(transition.id).toBe("transition-1");
    expect(transition.kind).toBe("PUSH");
    expect(transition.routerId).toBe("test-router");
    expect(transition.participants.screens).toBe(1);
    expect(transition.durationMs).toBeGreaterThanOrEqual(0);
    expect(transition.endAudit.residualInlineTransforms).toEqual([]);
    expect(transition.endAudit.offViewportAtRest).toBe(false);
  });

  it("classifies a foreign inline driver and flags residual inline pose at landing", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    // The inline DOM signature: `animation` suppression plus an advancing
    // inline transform, which is what a per-frame writer leaves. flemo
    // compiles every animation, so seeing this means something ELSE is
    // driving the screen.
    screen.style.animation = "none";
    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    screen.style.transform = "translate3d(80%, 0px, 0px)";
    await frames(2);
    screen.style.transform = "translate3d(40%, 0px, 0px)";
    await frames(2);

    // A buggy endAudit: the from-pose survives COMPLETED.
    screen.style.transform = "translate3d(100%, 0px, 0px)";
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const report = handle!.report();
    expect(report.transitions).toHaveLength(1);
    const transition = report.transitions[0];
    expect(transition.driver).toBe("inline");
    expect(
      transition.endAudit.residualInlineTransforms.some((entry) =>
        entry.includes("translate3d(100%, 0px, 0px)")
      )
    ).toBe(true);
    expect(
      transition.anomalies.some((entry) => entry.includes("residual inline style after COMPLETED"))
    ).toBe(true);
  });

  it("tracks anim-holds, their release, and segments frame gaps by phase", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    screen.setAttribute("data-flemo-anim-hold", "park-under");
    await settle();
    await frames(3);
    screen.setAttribute("data-flemo-anim-hold", "false");
    await settle();
    await frames(3);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3);

    const transition = handle!.report().transitions[0];
    expect(transition.holds.kind).toBe("park-under");
    expect(transition.holds.releasedAtMs).toBeGreaterThanOrEqual(0);
    // Frames sampled on both sides of the release boundary land in their
    // phase buckets, and the overall stats cover both.
    expect(transition.frameSamples.held.count).toBeGreaterThanOrEqual(1);
    expect(transition.frameSamples.released.count).toBeGreaterThanOrEqual(1);
    expect(transition.frameSamples.count).toBe(
      transition.frameSamples.held.count + transition.frameSamples.released.count
    );
  });

  it("reads a pop's kind off the status it was recorded from", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "POPPING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    await frames(2);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3);

    expect(handle!.report().transitions[0].kind).toBe("POP");
  });

  it("names a persisted retired key as inert residue", () => {
    // The library stopped reading this key with the rAF player. A report must
    // still surface it — and say plainly that it explains nothing — so an
    // investigator rules it out instead of chasing it.
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);
    attach();
    const report = handle!.report();
    expect(
      Object.keys(report.overrides.active).some(
        (key) => key.startsWith("flemo:motion-driver-force") && key.includes("retired")
      )
    ).toBe(true);
    expect(report.overrides.warnings.some((entry) => entry.includes("RETIRED residue"))).toBe(true);
  });

  it("caps stored transitions at maxTransitions", async () => {
    const screen = mountScreen();
    attach({ maxTransitions: 2 });
    await settle();

    for (let run = 0; run < 3; run += 1) {
      screen.setAttribute("data-flemo-status", "PUSHING");
      await settle();
      screen.setAttribute("data-flemo-status", "COMPLETED");
      await settle();
    }
    await frames(3);

    const report = handle!.report();
    expect(report.transitions).toHaveLength(2);
    expect(report.transitions[1].id).toBe("transition-3");
  });
});
