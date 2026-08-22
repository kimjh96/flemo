import { afterEach, describe, expect, it, vi } from "vitest";

import { armFramePacingKeepalive, resetDisplayProbeForTests } from "@platform/displayProbe";

// The keepalive's callback does nothing; its EXISTENCE is the fix — a live
// frame source keeps Chrome presenting on every vsync instead of pacing a
// compositor-driven flight unevenly. So the only things worth pinning are that
// it survives an environment with no rAF at all, and that overlapping flights
// share one loop.

afterEach(() => {
  vi.unstubAllGlobals();
  resetDisplayProbeForTests();
});

describe("armFramePacingKeepalive", () => {
  it("is a no-op where requestAnimationFrame does not exist (SSR, a bare worker)", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    expect(() => armFramePacingKeepalive()()).not.toThrow();
  });

  it("starts one loop however many flights arm it", () => {
    let started = 0;
    vi.stubGlobal("requestAnimationFrame", () => {
      started += 1;
      return started;
    });
    armFramePacingKeepalive();
    armFramePacingKeepalive();
    // CONTINUOUS by design: a per-flight loop lets an adaptive panel re-ramp
    // from idle on every navigation, which is the drop this exists to remove.
    expect(started).toBe(1);
  });
});
