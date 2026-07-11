import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { animHoldKey, eagerlyDecodeImages, scheduleAnimHoldRelease } from "@screen/animStartAnchor";

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

  it("holds the requested extra vsyncs (parked screen) before releasing", () => {
    const release = vi.fn();
    scheduleAnimHoldRelease(release, { extraFrames: 2 });

    flushFrame(); // first frame (pre-paint)
    flushFrame(); // second frame → enters the extra-frame chain
    expect(release).not.toHaveBeenCalled();

    flushFrame(); // extra frame 1
    expect(release).not.toHaveBeenCalled();

    flushFrame(); // extra frame 2 → release
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

describe("scheduleAnimHoldRelease decode wait", () => {
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

  const fakeScope = (images: unknown[]) =>
    ({ querySelectorAll: () => images }) as unknown as HTMLElement;

  it("waits for the scope's loaded images to decode before releasing", async () => {
    const release = vi.fn();
    let resolveDecode!: () => void;
    const image = {
      complete: true,
      decode: () => new Promise<void>((resolve) => (resolveDecode = resolve))
    };
    scheduleAnimHoldRelease(release, { scope: fakeScope([image]) });

    flushFrame();
    flushFrame();
    await Promise.resolve();
    expect(release).not.toHaveBeenCalled();

    resolveDecode();
    for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("skips images that have not loaded (decode would wait on the network)", async () => {
    const release = vi.fn();
    const pending = { complete: false, decode: vi.fn() };
    scheduleAnimHoldRelease(release, { scope: fakeScope([pending]) });

    flushFrame();
    flushFrame();
    await Promise.resolve();
    expect(pending.decode).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("caps the decode wait so a pathological screen cannot stall the hold", async () => {
    const release = vi.fn();
    const stuck = { complete: true, decode: () => new Promise<void>(() => {}) };
    scheduleAnimHoldRelease(release, { scope: fakeScope([stuck]) });

    flushFrame();
    flushFrame();
    await Promise.resolve();
    expect(release).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("does not release after cancellation even when a decode settles", async () => {
    const release = vi.fn();
    let resolveDecode!: () => void;
    const image = {
      complete: true,
      decode: () => new Promise<void>((resolve) => (resolveDecode = resolve))
    };
    const cancel = scheduleAnimHoldRelease(release, { scope: fakeScope([image]) });

    flushFrame();
    flushFrame();
    cancel();
    resolveDecode();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(1000);
    expect(release).not.toHaveBeenCalled();
  });
});

describe("eagerlyDecodeImages", () => {
  const fakeScope = (images: unknown[]) =>
    ({ querySelectorAll: () => images }) as unknown as HTMLElement;

  it("fires decode on loaded images and skips unloaded ones", () => {
    const loaded = { complete: true, decode: vi.fn(() => Promise.resolve()) };
    const pending = { complete: false, decode: vi.fn() };
    eagerlyDecodeImages(fakeScope([loaded, pending]));

    expect(loaded.decode).toHaveBeenCalledTimes(1);
    expect(pending.decode).not.toHaveBeenCalled();
  });

  it("swallows decode rejections (broken images must not throw)", async () => {
    const broken = { complete: true, decode: vi.fn(() => Promise.reject(new Error("x"))) };
    eagerlyDecodeImages(fakeScope([broken]));
    await Promise.resolve();
    await Promise.resolve();
    expect(broken.decode).toHaveBeenCalled();
  });

  it("is a no-op without a scope", () => {
    expect(() => eagerlyDecodeImages(null)).not.toThrow();
  });
});
