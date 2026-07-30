import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NATIVE_STALL_STEP_MS, watchNativeStalls } from "@core/engine/nativeStallAnchor";

interface FakeAnimation {
  animationName?: string;
  playState: string;
  startTime: number | null;
}

const fakeElement = (animations: FakeAnimation[]) => {
  const seenOptions: unknown[] = [];
  const element = {
    getAnimations: (options?: unknown) => {
      seenOptions.push(options);
      return animations;
    }
  } as unknown as HTMLElement;
  return { element, seenOptions };
};

describe("watchNativeStalls", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const pump = (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(time));
  };

  beforeEach(() => {
    frames = new Map();
    frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.set(++frameId, frameCallback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames.delete(handle);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ordinary frame gaps shift nothing", () => {
    const animation: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 100
    };
    const { element } = fakeElement([animation]);
    const onStall = vi.fn();
    const detach = watchNativeStalls(() => [element], onStall);

    pump(0);
    pump(17);
    pump(33); // a natural double-vsync gap sits inside the step cap
    expect(animation.startTime).toBe(100);
    expect(onStall).not.toHaveBeenCalled();
    detach();
  });

  it("a stall shifts running flemo animations by the excess and reports it", () => {
    const screen: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 100
    };
    const consumer: FakeAnimation = {
      animationName: "skeleton-wave",
      playState: "running",
      startTime: 100
    };
    const paused: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-false",
      playState: "paused",
      startTime: 100
    };
    const pending: FakeAnimation = {
      animationName: "flemo-decorator-overlay-PUSHING-false",
      playState: "running",
      startTime: null
    };
    const { element, seenOptions } = fakeElement([screen, consumer, paused, pending]);
    const onStall = vi.fn();
    const detach = watchNativeStalls(() => [element], onStall);

    pump(0);
    pump(100); // a 100ms stall → excess ≈ 100 − two frames
    const excess = 100 - NATIVE_STALL_STEP_MS;
    expect(screen.startTime).toBeCloseTo(100 + excess, 5);
    // Consumer animations, paused holds, and pending start times are left
    // alone — only running flemo timelines re-anchor.
    expect(consumer.startTime).toBe(100);
    expect(paused.startTime).toBe(100);
    expect(pending.startTime).toBeNull();
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(onStall.mock.calls[0]![0]).toBeCloseTo(excess, 5);
    // The first element is searched subtree-wide (parts live inside the
    // scope); the option object is what jsdom-free runtimes receive.
    expect(seenOptions[0]).toEqual({ subtree: true });
    detach();
  });

  it("secondary elements (decorator, bars) are searched without subtree", () => {
    const screenAnim: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 0
    };
    const decoratorAnim: FakeAnimation = {
      animationName: "flemo-decorator-overlay-PUSHING-false",
      playState: "running",
      startTime: 0
    };
    const scope = fakeElement([screenAnim]);
    const decorator = fakeElement([decoratorAnim]);
    const detach = watchNativeStalls(() => [scope.element, decorator.element, null]);

    pump(0);
    pump(200);
    expect(screenAnim.startTime).toBeGreaterThan(0);
    expect(decoratorAnim.startTime).toBeGreaterThan(0);
    expect(decorator.seenOptions[0]).toEqual({ subtree: false });
    detach();
  });

  it("an element without getAnimations is skipped", () => {
    const bare = {} as unknown as HTMLElement;
    const detach = watchNativeStalls(() => [bare]);
    pump(0);
    pump(200); // must not throw
    detach();
  });

  it("detach stops the watcher", () => {
    const animation: FakeAnimation = {
      animationName: "flemo-screen-cupertino-PUSHING-true",
      playState: "running",
      startTime: 0
    };
    const { element } = fakeElement([animation]);
    const detach = watchNativeStalls(() => [element]);
    pump(0);
    detach();
    pump(500);
    expect(animation.startTime).toBe(0);
    expect(frames.size).toBe(0);
  });
});
