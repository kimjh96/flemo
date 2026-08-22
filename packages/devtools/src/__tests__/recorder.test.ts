import { afterEach, describe, expect, it } from "vitest";

import { attachFlightRecorder } from "../recorder";

import type { FlightRecorderHandle } from "../types";

const frame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const frames = async (count: number) => {
  for (let index = 0; index < count; index += 1) await frame();
};

// Mutation delivery is a microtask; a macrotask hop makes it deterministic.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let handle: FlightRecorderHandle | null = null;

const attach = (options?: Parameters<typeof attachFlightRecorder>[0]) => {
  handle = attachFlightRecorder(options);
  return handle;
};

afterEach(() => {
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
  sessionStorage.clear();
  localStorage.clear();
  delete (window as unknown as { flemo?: unknown }).flemo;
  delete (window as unknown as { __flemoPlayerGaps?: number[] }).__flemoPlayerGaps;
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

describe("attachFlightRecorder", () => {
  it("is idempotent while attached and re-attachable after detach", () => {
    const first = attach();
    expect(attachFlightRecorder()).toBe(first);
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
    expect(recorder.report().version).toBe("2");
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
    expect(report.version).toBe("2");
    expect(report.blindSpots.length).toBeGreaterThanOrEqual(4);
    expect(report.flights).toEqual([]);
    expect(report.overrides).toEqual({ active: {}, warnings: [] });
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it("records a PUSH flight from data-flemo-status attribute flips", async () => {
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
    expect(report.flights).toHaveLength(1);
    const flight = report.flights[0];
    expect(flight.id).toBe("flight-1");
    expect(flight.kind).toBe("PUSH");
    expect(flight.routerId).toBe("test-router");
    expect(flight.participants.screens).toBe(1);
    expect(flight.durationMs).toBeGreaterThanOrEqual(0);
    expect(flight.landing.residualInlineTransforms).toEqual([]);
    expect(flight.landing.offViewportAtRest).toBe(false);
  });

  it("classifies the player signature and flags residual inline pose at landing", async () => {
    const screen = mountScreen();
    attach();
    await settle();

    // Player DOM signature: inline `animation` suppression + advancing
    // inline transform (what a per-frame writer leaves each frame).
    screen.style.animation = "none";
    screen.setAttribute("data-flemo-status", "PUSHING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    screen.style.transform = "translate3d(80%, 0px, 0px)";
    await frames(2);
    screen.style.transform = "translate3d(40%, 0px, 0px)";
    await frames(2);

    // A buggy landing: the from-pose survives COMPLETED.
    screen.style.transform = "translate3d(100%, 0px, 0px)";
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const report = handle!.report();
    expect(report.flights).toHaveLength(1);
    const flight = report.flights[0];
    expect(flight.driver).toBe("player");
    expect(
      flight.landing.residualInlineTransforms.some((entry) =>
        entry.includes("translate3d(100%, 0px, 0px)")
      )
    ).toBe(true);
    expect(
      flight.anomalies.some((entry) => entry.includes("residual inline style after COMPLETED"))
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

    const flight = handle!.report().flights[0];
    expect(flight.holds.kind).toBe("park-under");
    expect(flight.holds.releasedAtMs).toBeGreaterThanOrEqual(0);
    // Frames sampled on both sides of the release boundary land in their
    // phase buckets, and the overall stats cover both.
    expect(flight.frameSamples.held.count).toBeGreaterThanOrEqual(1);
    expect(flight.frameSamples.released.count).toBeGreaterThanOrEqual(1);
    expect(flight.frameSamples.count).toBe(
      flight.frameSamples.held.count + flight.frameSamples.released.count
    );
  });

  it("summarizes the player gap mirror growth during the flight", async () => {
    const screen = mountScreen();
    (window as unknown as { __flemoPlayerGaps: number[] }).__flemoPlayerGaps = [12.0];
    attach();
    await settle();

    screen.setAttribute("data-flemo-status", "POPPING");
    screen.setAttribute("data-flemo-active", "true");
    await settle();
    (window as unknown as { __flemoPlayerGaps: number[] }).__flemoPlayerGaps.push(16.7, 42.3);
    await frames(2);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3);

    const flight = handle!.report().flights[0];
    expect(flight.kind).toBe("POP");
    expect(flight.playerGaps).toEqual({ maxMs: 42.3, over30Count: 1 });
    expect(flight.anomalies.some((entry) => entry.includes("player frame gap up to 42.3ms"))).toBe(
      true
    );
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

  it("caps stored flights at maxFlights", async () => {
    const screen = mountScreen();
    attach({ maxFlights: 2 });
    await settle();

    for (let run = 0; run < 3; run += 1) {
      screen.setAttribute("data-flemo-status", "PUSHING");
      await settle();
      screen.setAttribute("data-flemo-status", "COMPLETED");
      await settle();
    }
    await frames(3);

    const report = handle!.report();
    expect(report.flights).toHaveLength(2);
    expect(report.flights[1].id).toBe("flight-3");
  });
});
