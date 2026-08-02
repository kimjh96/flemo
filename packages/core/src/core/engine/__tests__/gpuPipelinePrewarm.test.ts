import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ensureGpuPipelinePrewarm, {
  GPU_PREWARM_ATTR,
  PREWARM_SPAN_MS,
  resetGpuPipelinePrewarmForTesting
} from "@core/engine/gpuPipelinePrewarm";

// The one-shot GPU pipeline prewarm (gpuPipelinePrewarm.ts): imperceptible
// probes at boot idle draw the flight's pipeline variants so a cold Graphite
// cache compiles before any motion, not inside the first flight.

const host = () => document.querySelector<HTMLElement>(`[${GPU_PREWARM_ATTR}]`);

describe("gpuPipelinePrewarm", () => {
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    resetGpuPipelinePrewarmForTesting();
    // jsdom has no Web Animations; a stub turns the guard into the real path.
    animate = vi.fn(() => ({ cancel: vi.fn() }));
    (Element.prototype as unknown as { animate: unknown }).animate = animate;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (Element.prototype as unknown as { animate?: unknown }).animate;
    host()?.remove();
  });

  it("without Element.animate the prewarm is a no-op", () => {
    delete (Element.prototype as unknown as { animate?: unknown }).animate;
    ensureGpuPipelinePrewarm();
    vi.runAllTimers();
    expect(host()).toBeNull();
  });

  it("mounts imperceptible probes at idle, animates them, and removes after the span", () => {
    ensureGpuPipelinePrewarm();
    // Scheduled, not yet run: off the mount commit's critical path.
    expect(host()).toBeNull();

    vi.advanceTimersByTime(200);
    const mounted = host();
    expect(mounted).not.toBeNull();
    expect(mounted!.getAttribute("aria-hidden")).toBe("true");
    expect(mounted!.style.opacity).toBe("0.02");
    expect(mounted!.style.pointerEvents).toBe("none");
    // Both draw shapes animate: the textured/text layer and the translucent quad.
    expect(animate).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(PREWARM_SPAN_MS);
    expect(host()).toBeNull();
  });

  it("runs once per page — a second Router draws nothing extra", () => {
    ensureGpuPipelinePrewarm();
    ensureGpuPipelinePrewarm();
    vi.advanceTimersByTime(200);
    expect(document.querySelectorAll(`[${GPU_PREWARM_ATTR}]`).length).toBe(1);
    vi.runAllTimers();
    ensureGpuPipelinePrewarm();
    vi.runAllTimers();
    expect(host()).toBeNull();
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("disposal before firing cancels and returns to cold, so a later Router still prewarms", () => {
    const dispose = ensureGpuPipelinePrewarm();
    dispose();
    vi.runAllTimers();
    expect(host()).toBeNull();
    expect(animate).not.toHaveBeenCalled();

    ensureGpuPipelinePrewarm();
    vi.advanceTimersByTime(200);
    expect(host()).not.toBeNull();
    vi.runAllTimers();
  });

  it("disposal after firing tears the probes down immediately", () => {
    const dispose = ensureGpuPipelinePrewarm();
    vi.advanceTimersByTime(200);
    expect(host()).not.toBeNull();
    dispose();
    expect(host()).toBeNull();
  });
});
