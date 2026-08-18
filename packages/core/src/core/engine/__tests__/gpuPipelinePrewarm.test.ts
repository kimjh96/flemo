import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ensureGpuPipelinePrewarm, {
  GPU_PREWARM_ATTR,
  PREWARM_SPAN_MS,
  resetGpuPipelinePrewarmForTesting
} from "@core/engine/gpuPipelinePrewarm";

// The one-shot GPU pipeline prewarm (gpuPipelinePrewarm.ts): imperceptible
// probes at boot idle draw the flight's pipeline variants so a cold Graphite
// cache compiles before any motion. Blink-only (Graphite/Dawn is Chromium's
// rasterizer), refcounted across Routers, self-clocked teardown.

const host = () => document.querySelector<HTMLElement>(`[${GPU_PREWARM_ATTR}]`);

describe("gpuPipelinePrewarm", () => {
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    resetGpuPipelinePrewarmForTesting();
    // jsdom has no Web Animations; a stub turns the guard into the real path.
    animate = vi.fn(() => ({ cancel: vi.fn() }));
    (Element.prototype as unknown as { animate: unknown }).animate = animate;
    // The prewarm is Blink-gated: present a Chromium brand.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Chromium", version: "120" }] },
      configurable: true
    });
    // jsdom has no requestIdleCallback; model it as a fake-timer schedule so
    // advancing the clock fires the probe deterministically.
    (globalThis as unknown as { requestIdleCallback: unknown }).requestIdleCallback = (
      cb: () => void
    ) => setTimeout(cb, 0) as unknown as number;
    (globalThis as unknown as { cancelIdleCallback: unknown }).cancelIdleCallback = (id: number) =>
      clearTimeout(id);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (Element.prototype as unknown as { animate?: unknown }).animate;
    delete (globalThis as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (globalThis as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback;
    delete (navigator as { userAgentData?: unknown }).userAgentData;
    host()?.remove();
  });

  it("is a no-op on a non-Blink engine (Graphite/Dawn is Chromium-only)", () => {
    delete (navigator as { userAgentData?: unknown }).userAgentData;
    ensureGpuPipelinePrewarm();
    vi.runAllTimers();
    expect(host()).toBeNull();
    expect(animate).not.toHaveBeenCalled();
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

    vi.advanceTimersByTime(0); // the idle callback fires
    const mounted = host();
    expect(mounted).not.toBeNull();
    expect(mounted!.getAttribute("aria-hidden")).toBe("true");
    expect(mounted!.style.opacity).toBe("0.02");
    expect(mounted!.style.pointerEvents).toBe("none");
    // All three probe layers animate: textured/text, translucent, and the quad.
    expect(animate).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(PREWARM_SPAN_MS);
    expect(host()).toBeNull();
  });

  it("runs once per page — a second Router draws nothing extra", () => {
    ensureGpuPipelinePrewarm();
    ensureGpuPipelinePrewarm();
    vi.advanceTimersByTime(0);
    expect(document.querySelectorAll(`[${GPU_PREWARM_ATTR}]`).length).toBe(1);
    vi.runAllTimers();
    ensureGpuPipelinePrewarm();
    vi.runAllTimers();
    expect(host()).toBeNull();
    expect(animate).toHaveBeenCalledTimes(3);
  });

  it("the LAST owner leaving before firing cancels; a surviving owner keeps it", () => {
    const disposeA = ensureGpuPipelinePrewarm();
    const disposeB = ensureGpuPipelinePrewarm();
    // A leaves, but B is still mounted → the prewarm must still fire.
    disposeA();
    vi.advanceTimersByTime(0);
    expect(host()).not.toBeNull();
    expect(animate).toHaveBeenCalledTimes(3);
    vi.runAllTimers();
    disposeB(); // after firing: no-op (host self-tore-down)
  });

  it("disposal by the only owner before firing cancels and returns to cold", () => {
    const dispose = ensureGpuPipelinePrewarm();
    dispose();
    vi.runAllTimers();
    expect(host()).toBeNull();
    expect(animate).not.toHaveBeenCalled();

    // A later Router still prewarms.
    ensureGpuPipelinePrewarm();
    vi.advanceTimersByTime(0);
    expect(host()).not.toBeNull();
    vi.runAllTimers();
  });

  it("defers the probe while a flemo transition is in flight, then runs when idle", () => {
    // A screen mid-transition on the page: the probe must NOT attach (its
    // Dawn compile would collide with the live motion).
    const screen = document.createElement("div");
    screen.setAttribute("data-flemo-screen", "");
    screen.setAttribute("data-flemo-status", "PUSHING");
    document.body.appendChild(screen);

    ensureGpuPipelinePrewarm();
    // The idle fires while a flight is active → the probe reschedules instead
    // of attaching. (runOnlyPendingTimers, not runAllTimers: the reschedule is
    // a fresh timer created during the run, so we step one idle at a time.)
    vi.runOnlyPendingTimers();
    expect(host()).toBeNull();
    expect(animate).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers(); // still flying → still deferred
    expect(host()).toBeNull();

    // The flight settles; the next idle runs the probe.
    screen.setAttribute("data-flemo-status", "COMPLETED");
    vi.runOnlyPendingTimers();
    expect(host()).not.toBeNull();
    expect(animate).toHaveBeenCalledTimes(3);

    screen.remove();
  });

  it("a navigation starting AFTER the probe attached lets it finish its span (accepted)", () => {
    // The compiles are enqueued at the probe's first draw; cancelling
    // mid-span retracts nothing, so a started probe completes on its clock.
    ensureGpuPipelinePrewarm();
    vi.advanceTimersByTime(0); // idle fires with no flight → probe attaches
    expect(host()).not.toBeNull();

    const screen = document.createElement("div");
    screen.setAttribute("data-flemo-status", "PUSHING");
    document.body.appendChild(screen);

    vi.advanceTimersByTime(PREWARM_SPAN_MS - 1);
    expect(host()).not.toBeNull(); // still finishing its span
    vi.advanceTimersByTime(1);
    expect(host()).toBeNull(); // self-teardown on schedule, flight or not

    screen.remove();
  });

  it("disposal AFTER firing never cuts the probe span short (self-clocked teardown)", () => {
    const dispose = ensureGpuPipelinePrewarm();
    vi.advanceTimersByTime(0);
    expect(host()).not.toBeNull();
    // A Router unmounting mid-probe must NOT remove the host early — the
    // compile needs its full span of presented frames.
    dispose();
    expect(host()).not.toBeNull();
    vi.advanceTimersByTime(PREWARM_SPAN_MS);
    expect(host()).toBeNull();
  });
});
