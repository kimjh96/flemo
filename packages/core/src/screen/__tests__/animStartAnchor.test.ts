import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NavigateStatus } from "@navigate/store";

import {
  animHoldKey,
  createAnimHoldCoordinator,
  eagerlyDecodeImages,
  scheduleAnimHoldReadiness,
  scheduleAnimHoldRelease,
  shouldMountShellFirst
} from "@screen/animStartAnchor";

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

describe("shouldMountShellFirst", () => {
  const HELD = "PUSHING:cupertino";

  // Every combination of the three inputs. Only the ACTIVE screen mounting into
  // a PUSH or REPLACE with a live hold key defers; everything else renders its
  // children immediately.
  const cases: {
    holdKey: string | null;
    isActive: boolean;
    status: NavigateStatus;
    expected: boolean;
    why: string;
  }[] = [
    {
      holdKey: HELD,
      isActive: true,
      status: "PUSHING",
      expected: true,
      why: "active push entrant"
    },
    {
      holdKey: "REPLACING:cupertino",
      isActive: true,
      status: "REPLACING",
      expected: true,
      why: "active replace entrant"
    },
    {
      holdKey: "POPPING:cupertino",
      isActive: true,
      status: "POPPING",
      expected: false,
      why: "pop introduces no fresh screen; the revealed screen shows content at once"
    },
    {
      holdKey: HELD,
      isActive: false,
      status: "PUSHING",
      expected: false,
      why: "the covered/leaving side never withholds its content"
    },
    {
      holdKey: null,
      isActive: true,
      status: "COMPLETED",
      expected: false,
      why: "rest mount: no hold, children render immediately"
    },
    {
      holdKey: null,
      isActive: true,
      status: "IDLE",
      expected: false,
      why: "hydration/SSR: children render into the HTML in place"
    },
    {
      holdKey: null,
      isActive: true,
      status: "PUSHING",
      expected: false,
      why: "no hold key means this screen is not participating; nothing to defer against"
    },
    {
      holdKey: HELD,
      isActive: false,
      status: "POPPING",
      expected: false,
      why: "revealed frozen screen: inactive and not push/replace"
    }
  ];

  for (const { holdKey, isActive, status, expected, why } of cases) {
    it(`${expected} — ${why} (holdKey=${holdKey}, isActive=${isActive}, status=${status})`, () => {
      expect(shouldMountShellFirst({ holdKey, isActive, status })).toBe(expected);
    });
  }
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

describe("scheduleAnimHoldReadiness", () => {
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

  it("fires onReady on the second frame (after the first heavy paint)", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady);

    flushFrame();
    expect(onReady).not.toHaveBeenCalled();

    flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("has NO backstop of its own — without frames it never fires (the caller owns the backstop)", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady);

    vi.advanceTimersByTime(10_000);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("cancels its frame chain", () => {
    const onReady = vi.fn();
    const cancel = scheduleAnimHoldReadiness(onReady);
    cancel();

    flushFrame();
    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("cancels a chain that already advanced into its extra frames (parked screen)", () => {
    const onReady = vi.fn();
    const cancel = scheduleAnimHoldReadiness(onReady, { extraFrames: 2 });

    flushFrame(); // first frame (pre-paint)
    flushFrame(); // second frame → enters the extra-frame chain
    flushFrame(); // extra frame 1 → queues extra frame 2
    cancel();

    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("decodeWait:false skips the decode wait entirely (ready after 2 frames despite a loaded image)", () => {
    const onReady = vi.fn();
    // A loaded image whose decode never settles: with the wait it would hang;
    // decodeWait:false must ignore it and never even call decode().
    const decode = vi.fn(() => new Promise<void>(() => {}));
    const scope = {
      querySelectorAll: () => [{ complete: true, decode }]
    } as unknown as HTMLElement;
    scheduleAnimHoldReadiness(onReady, { scope, decodeWait: false });

    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
    flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(decode).not.toHaveBeenCalled();
  });

  it("waits on the scope's decodes by default (decodeWait omitted)", async () => {
    const onReady = vi.fn();
    let resolveDecode!: () => void;
    const scope = {
      querySelectorAll: () => [
        { complete: true, decode: () => new Promise<void>((resolve) => (resolveDecode = resolve)) }
      ]
    } as unknown as HTMLElement;
    scheduleAnimHoldReadiness(onReady, { scope });

    flushFrame();
    flushFrame();
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();

    resolveDecode();
    for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe("createAnimHoldCoordinator", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;

  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };

  // Advance both members' readiness chains past their two-frame paint anchor.
  const flushPaintAnchor = () => {
    flushFrame();
    flushFrame();
  };

  const flushMicrotasks = async () => {
    for (let hop = 0; hop < 8; hop++) await Promise.resolve();
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

  // A scope whose single loaded image resolves its decode only when the
  // returned trigger is called — the image-heavy revealed screen whose late
  // decode used to let the exiting top start first.
  const controllableScope = () => {
    let resolveDecode!: () => void;
    const image = {
      complete: true,
      decode: () => new Promise<void>((resolve) => (resolveDecode = resolve))
    };
    const scope = { querySelectorAll: () => [image] } as unknown as HTMLElement;
    return { scope, resolveDecode: () => resolveDecode() };
  };

  it("holds a POPPING pair until BOTH are ready, then releases them in one tick", async () => {
    const coordinator = createAnimHoldCoordinator();
    const fast = vi.fn();
    const slow = vi.fn();
    const slowScope = controllableScope();

    coordinator.join("POPPING:cupertino", fast);
    coordinator.join("POPPING:cupertino", slow, { scope: slowScope.scope });

    flushPaintAnchor();
    await flushMicrotasks();
    // The exiting top is ready in two frames but must NOT start without its
    // revealed partner (whose decode is still in flight).
    expect(fast).not.toHaveBeenCalled();
    expect(slow).not.toHaveBeenCalled();

    slowScope.resolveDecode();
    await flushMicrotasks();
    expect(fast).toHaveBeenCalledTimes(1);
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("groups a PUSHING pair: held until BOTH are ready, then released together", async () => {
    const coordinator = createAnimHoldCoordinator();
    const first = vi.fn();
    const second = vi.fn();
    const secondScope = controllableScope();

    coordinator.join("PUSHING:cupertino", first);
    coordinator.join("PUSHING:cupertino", second, { scope: secondScope.scope });

    flushPaintAnchor();
    await flushMicrotasks();
    // Push now pair-gates exactly like pop (the crossfade-desync fix): `first`
    // is ready in two frames but must wait on `second`'s in-flight decode
    // instead of starting ~100ms ahead of it.
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    secondScope.resolveDecode();
    await flushMicrotasks();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("groups a REPLACING pair the same way", async () => {
    const coordinator = createAnimHoldCoordinator();
    const first = vi.fn();
    const second = vi.fn();
    const secondScope = controllableScope();

    coordinator.join("REPLACING:cupertino", first);
    coordinator.join("REPLACING:cupertino", second, { scope: secondScope.scope });

    flushPaintAnchor();
    await flushMicrotasks();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    secondScope.resolveDecode();
    await flushMicrotasks();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("a push/replace pair with decodeWait:false releases at the paint anchor (no decode wait)", async () => {
    const coordinator = createAnimHoldCoordinator();
    const enter = vi.fn();
    const exit = vi.fn();
    // Both members carry a loaded image whose decode NEVER settles, but pass
    // decodeWait:false (visible exit side + fresh enter side). The pair must
    // still release on the two-frame anchor — the "pairing is free" property.
    const stuck = () => {
      const image = { complete: true, decode: () => new Promise<void>(() => {}) };
      return { querySelectorAll: () => [image] } as unknown as HTMLElement;
    };
    coordinator.join("PUSHING:cupertino", enter, { scope: stuck(), decodeWait: false });
    coordinator.join("PUSHING:cupertino", exit, { scope: stuck(), decodeWait: false });

    flushPaintAnchor();
    await flushMicrotasks();
    expect(enter).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("releases the whole pair together at the ONE group backstop when frames never come", () => {
    const coordinator = createAnimHoldCoordinator();
    const first = vi.fn();
    const second = vi.fn();

    coordinator.join("POPPING:cupertino", first);
    coordinator.join("POPPING:cupertino", second, { scope: controllableScope().scope });

    // No frames flushed (a backgrounded tab): neither readiness gate advances.
    vi.advanceTimersByTime(299);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cancelling one of a not-yet-ready pair leaves the other to release at its own readiness", async () => {
    const coordinator = createAnimHoldCoordinator();
    const staying = vi.fn();
    const leaving = vi.fn();

    coordinator.join("POPPING:cupertino", staying);
    const cancelLeaving = coordinator.join("POPPING:cupertino", leaving);

    cancelLeaving();

    flushPaintAnchor();
    await flushMicrotasks();
    expect(leaving).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledTimes(1);
  });

  it("cancelling the still-pending member releases an already-ready partner immediately", async () => {
    const coordinator = createAnimHoldCoordinator();
    const readyMember = vi.fn();
    const pending = vi.fn();
    const pendingScope = controllableScope();

    coordinator.join("POPPING:cupertino", readyMember);
    const cancelPending = coordinator.join("POPPING:cupertino", pending, {
      scope: pendingScope.scope
    });

    flushPaintAnchor();
    await flushMicrotasks();
    // readyMember is ready but held for its partner.
    expect(readyMember).not.toHaveBeenCalled();

    cancelPending();
    expect(readyMember).toHaveBeenCalledTimes(1);
    expect(pending).not.toHaveBeenCalled();
  });

  it("cancelling the last member dissolves the group and clears its backstop (no stray timer)", () => {
    const coordinator = createAnimHoldCoordinator();
    const only = vi.fn();
    const cancelOnly = coordinator.join("POPPING:cupertino", only);

    cancelOnly();

    vi.advanceTimersByTime(1000);
    flushFrame();
    flushFrame();
    expect(only).not.toHaveBeenCalled();
  });

  it("is a no-op to cancel after the group has already released", async () => {
    const coordinator = createAnimHoldCoordinator();
    const a = vi.fn();
    const b = vi.fn();
    const cancelA = coordinator.join("POPPING:cupertino", a);
    const cancelB = coordinator.join("POPPING:cupertino", b);

    flushPaintAnchor();
    await flushMicrotasks();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    expect(() => {
      cancelA();
      cancelB();
    }).not.toThrow();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("a single-member POPPING group releases at its own readiness (root pop, no partner)", async () => {
    const coordinator = createAnimHoldCoordinator();
    const only = vi.fn();
    coordinator.join("POPPING:cupertino", only);

    flushFrame();
    expect(only).not.toHaveBeenCalled();
    flushFrame();
    await flushMicrotasks();
    expect(only).toHaveBeenCalledTimes(1);
  });

  it("a single-member POPPING group falls back to the backstop when frames never come", () => {
    const coordinator = createAnimHoldCoordinator();
    const only = vi.fn();
    coordinator.join("POPPING:cupertino", only);

    vi.advanceTimersByTime(300);
    expect(only).toHaveBeenCalledTimes(1);
  });

  it("re-joining a key after cancelling both members starts a fresh, isolated group", async () => {
    const coordinator = createAnimHoldCoordinator();
    const stale1 = vi.fn();
    const stale2 = vi.fn();
    const cancel1 = coordinator.join("POPPING:cupertino", stale1);
    const cancel2 = coordinator.join("POPPING:cupertino", stale2);
    cancel1();
    cancel2();

    // A fresh pop reuses the same hold key; the new group must not resurrect the
    // torn-down members (the interrupt / re-entry case).
    const fresh1 = vi.fn();
    const fresh2 = vi.fn();
    coordinator.join("POPPING:cupertino", fresh1);
    coordinator.join("POPPING:cupertino", fresh2);

    flushPaintAnchor();
    await flushMicrotasks();
    expect(stale1).not.toHaveBeenCalled();
    expect(stale2).not.toHaveBeenCalled();
    expect(fresh1).toHaveBeenCalledTimes(1);
    expect(fresh2).toHaveBeenCalledTimes(1);
  });

  it("separate coordinators never share a group for the same key", async () => {
    const scopeA = createAnimHoldCoordinator();
    const scopeB = createAnimHoldCoordinator();
    const a = vi.fn();
    const b = vi.fn();

    scopeA.join("POPPING:cupertino", a);
    scopeB.join("POPPING:cupertino", b, { scope: controllableScope().scope });

    flushPaintAnchor();
    await flushMicrotasks();
    // Scope A releases on its own; scope B's never-settling decode in a DIFFERENT
    // coordinator does not hold it back.
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
