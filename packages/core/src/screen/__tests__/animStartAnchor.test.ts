import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { animHoldKey, scheduleAnimHoldRelease } from "@screen/animStartAnchor";

describe("animHoldKey", () => {
  const base = { isTopOrTopPrev: true, transitionName: "cupertino" };

  it("keys a fresh transition segment for a participating screen", () => {
    expect(animHoldKey({ ...base, status: "PUSHING" })).toBe("PUSHING:cupertino");
    expect(animHoldKey({ ...base, status: "POPPING" })).toBe("POPPING:cupertino");
    expect(animHoldKey({ ...base, status: "REPLACING" })).toBe("REPLACING:cupertino");
  });

  it("is null at rest", () => {
    expect(animHoldKey({ ...base, status: "COMPLETED" })).toBeNull();
    expect(animHoldKey({ ...base, status: "IDLE" })).toBeNull();
  });

  it("is null for a screen that is neither the top nor the top's prev", () => {
    expect(animHoldKey({ ...base, status: "PUSHING", isTopOrTopPrev: false })).toBeNull();
  });
});

describe("scheduleAnimHoldRelease", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;

  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };

  beforeEach(() => {
    frames = new Map();
    frameId = 0;
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.set(++frameId, frameCallback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("releases on the second frame (after the first heavy paint)", () => {
    const release = vi.fn();
    scheduleAnimHoldRelease(release);

    flushFrame();
    expect(release).not.toHaveBeenCalled();

    flushFrame();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("falls back to a timeout when frames never come (backgrounded tab)", () => {
    const release = vi.fn();
    scheduleAnimHoldRelease(release);

    vi.advanceTimersByTime(300);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("cancels both the frame chain and the backstop", () => {
    const release = vi.fn();
    const cancel = scheduleAnimHoldRelease(release);
    cancel();

    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(1000);
    expect(release).not.toHaveBeenCalled();
  });

  it("cancels a chain that already advanced to its second frame", () => {
    const release = vi.fn();
    const cancel = scheduleAnimHoldRelease(release);

    flushFrame();
    cancel();

    flushFrame();
    vi.advanceTimersByTime(1000);
    expect(release).not.toHaveBeenCalled();
  });
});
