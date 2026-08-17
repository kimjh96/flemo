import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  lpmReleaseLatencyBudgetMs,
  reportLpmReleaseLatency,
  resetLowPowerCadenceForTests
} from "@core/engine/lowPowerCadence";
import { armLpmReleaseLatencyProbe } from "@core/engine/lpmReleaseLatencyProbe";

// Read-only release-latency observation: the worst rAF tick gap after the
// anim-hold release lands in the lowPowerCadence ledger, sizing the NEXT
// flight's entry hold. Nothing is ever written to styles or animations.

describe("lpm release latency", () => {
  let rafCbs: FrameRequestCallback[];
  let nowMs: number;

  beforeEach(() => {
    rafCbs = [];
    nowMs = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => (rafCbs.push(cb), rafCbs.length)
    );
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetLowPowerCadenceForTests();
    document.body.innerHTML = "";
  });

  const scopeEl = () => {
    const el = document.createElement("div");
    el.setAttribute("data-flemo-anim-hold", "true");
    document.body.appendChild(el);
    return el;
  };

  const tickAt = (t: number) => {
    nowMs = t;
    rafCbs.shift()?.(t);
  };

  it("ledger: keeps a rolling worst sample and stays null until fed", () => {
    expect(lpmReleaseLatencyBudgetMs()).toBeNull();
    reportLpmReleaseLatency(120);
    reportLpmReleaseLatency(80);
    expect(lpmReleaseLatencyBudgetMs()).toBe(120);
    // Caps absurd samples so one hung tab can never freeze future holds.
    reportLpmReleaseLatency(5000);
    expect(lpmReleaseLatencyBudgetMs()).toBe(600);
  });

  it("probe: reports the worst post-release tick gap through the window", async () => {
    const el = scopeEl();
    const detach = armLpmReleaseLatencyProbe(el);
    nowMs = 1000;
    el.setAttribute("data-flemo-anim-hold", "false");
    await Promise.resolve(); // observer microtask → engage at t=1000
    tickAt(1033);
    tickAt(1250); // 217ms governor gap
    tickAt(1283);
    tickAt(1520); // window (500ms) exceeded → report
    expect(lpmReleaseLatencyBudgetMs()).toBe(237); // the 1283→1520 gap is worst
    detach();
  });

  it("probe: arming after the release already happened measures nothing", async () => {
    const el = scopeEl();
    el.setAttribute("data-flemo-anim-hold", "false");
    const detach = armLpmReleaseLatencyProbe(el);
    expect(rafCbs.length).toBe(0);
    expect(lpmReleaseLatencyBudgetMs()).toBeNull();
    detach();
  });
});
