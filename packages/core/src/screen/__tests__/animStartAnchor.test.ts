import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Controllable stand-in for the pending-request counter the settle gate
// consults (the real module wraps window.fetch/XHR).
let pendingForTests = false;
const setPendingForTests = (value: boolean) => {
  pendingForTests = value;
};
vi.mock("@screen/pendingNetwork", () => ({
  hasPendingRequests: () => pendingForTests
}));

import {
  ANIM_HOLD_RELEASE_BACKSTOP_MS,
  animHoldKey,
  createAnimHoldCoordinator,
  eagerlyDecodeImages,
  scheduleAnimHoldReadiness,
  scheduleAnimHoldRelease
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

describe("scheduleAnimHoldReadiness content settle", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };

  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  const shellScope = () => {
    // Structure without text: reads as a skeleton awaiting content.
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  const contentScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) {
      const row = document.createElement("div");
      row.textContent = "이미 채워진 콘텐츠 행입니다";
      scope.appendChild(row);
    }
    document.body.appendChild(scope);
    return scope;
  };

  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("a screen that already carries content never waits", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope: contentScope(), contentSettle: SETTLE });
    flushFrame();
    flushFrame(); // paint anchor
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a shell with nothing in flight gives up on the short grace", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope: shellScope(), contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a loading shell waits for its content wave, then six quiet frames", async () => {
    setPendingForTests(true);
    const scope = shellScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    // Pending requests hold it past both the grace and the first-wave wait.
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    vi.advanceTimersByTime(SETTLE.firstWaitMs + 1);
    expect(onReady).not.toHaveBeenCalled();

    // The content wave lands (a batch big enough to be content, not shell).
    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) wave.appendChild(document.createElement("p"));
    scope.appendChild(wave);
    await Promise.resolve(); // MutationObserver delivery

    setPendingForTests(false);
    for (let i = 0; i < 6; i++) {
      expect(onReady).not.toHaveBeenCalled();
      flushFrame();
    }
    flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("the cap bounds the whole wait even while requests stay in flight", () => {
    setPendingForTests(true);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope: shellScope(), contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.capMs + 1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("cancelling mid-wait suppresses the release", () => {
    setPendingForTests(true);
    const onReady = vi.fn();
    const cancel = scheduleAnimHoldReadiness(onReady, {
      scope: shellScope(),
      contentSettle: SETTLE
    });
    flushFrame();
    flushFrame();
    cancel();
    vi.advanceTimersByTime(SETTLE.capMs + 10);
    expect(onReady).not.toHaveBeenCalled();
  });
});

describe("scheduleAnimHoldReadiness settle beats", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };
  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  const shellScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("quiet frames that end while requests are still in flight re-arm the wait", async () => {
    setPendingForTests(true);
    const scope = shellScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) wave.appendChild(document.createElement("p"));
    scope.appendChild(wave);
    await Promise.resolve();

    // Six quiet frames pass but a request is STILL pending: another beat is
    // coming, so the gate re-arms instead of releasing between beats.
    for (let i = 0; i < 7; i++) flushFrame();
    expect(onReady).not.toHaveBeenCalled();

    setPendingForTests(false);
    for (let i = 0; i < 7; i++) flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("the first-wave deadline keeps retrying while requests are in flight", () => {
    setPendingForTests(true);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope: shellScope(), contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    // Deadline reached with a request outstanding: content is genuinely
    // coming, so the give-up defers in 100ms steps instead of firing.
    vi.advanceTimersByTime(SETTLE.firstWaitMs + 1);
    expect(onReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onReady).not.toHaveBeenCalled();

    // The moment nothing is pending (and nothing ever arrived), it gives up.
    setPendingForTests(false);
    vi.advanceTimersByTime(101);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleAnimHoldReadiness settle boundaries", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };
  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  const shellScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("a wave landing at the cap finishes immediately instead of re-quieting", async () => {
    setPendingForTests(true);
    const scope = shellScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    // Ride the pending requests past the whole window, then land the wave.
    await vi.advanceTimersByTimeAsync(SETTLE.capMs - 1);
    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) wave.appendChild(document.createElement("p"));
    scope.appendChild(wave);
    await vi.advanceTimersByTimeAsync(2);
    await Promise.resolve();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("the first-wave deadline stands down once content has arrived", async () => {
    setPendingForTests(true);
    const scope = shellScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) wave.appendChild(document.createElement("p"));
    scope.appendChild(wave);
    await Promise.resolve();

    // The deadline fires with content already seen: it must defer to the
    // quiet-frame convergence, not force a release.
    await vi.advanceTimersByTimeAsync(SETTLE.firstWaitMs + 1);
    expect(onReady).not.toHaveBeenCalled();

    setPendingForTests(false);
    for (let i = 0; i < 7; i++) flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("small mutations never count as the content wave", async () => {
    const scope = shellScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    scope.appendChild(document.createElement("div")); // 1 node < minNodes
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SETTLE.graceMs + 1); // nothing pending: grace fires
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("text nodes count toward the wave one apiece", async () => {
    setPendingForTests(true);
    const scope = shellScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 31; i++) fragment.appendChild(document.createTextNode(`행 ${i}`));
    scope.appendChild(fragment);
    await Promise.resolve();

    setPendingForTests(false);
    for (let i = 0; i < 7; i++) flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a near-empty screen is a SHELL (deferred skeletons), exiting at the grace when idle", () => {
    // A deferred-skeleton consumer (render nothing for the first ~300ms)
    // mounts as a handful of empty containers. Treating that as "warm"
    // released the gate straight into the reveal render — device-video'd as
    // a blank sheet departing with a swallowed opening. Near-empty is
    // pre-content until the GRACE proves nothing is coming.
    const scope = document.createElement("div");
    scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    expect(onReady).not.toHaveBeenCalled(); // held: could be a deferred skeleton
    vi.advanceTimersByTime(SETTLE.graceMs + 1); // nothing pending → empty state
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a near-empty screen with requests in flight waits for its content", async () => {
    setPendingForTests(true);
    const scope = document.createElement("div");
    scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).not.toHaveBeenCalled(); // loading: the reveal is coming

    // The reveal lands; the wave settles and the gate releases.
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 31; i++) {
      const row = document.createElement("div");
      row.textContent = `의원 행 ${i} 내용이 충분히 길다`;
      fragment.appendChild(row);
    }
    scope.appendChild(fragment);
    await Promise.resolve();
    setPendingForTests(false);
    for (let i = 0; i < 7; i++) flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a scope without querySelectorAll cannot be judged and never waits", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, {
      scope: {} as HTMLElement,
      decodeWait: false,
      contentSettle: SETTLE
    });
    flushFrame();
    flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleAnimHoldReadiness consecutive waves", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };
  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("a second wave mid-quiet restarts the quiet count from its own frames", async () => {
    setPendingForTests(true);
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    const wave = () => {
      const section = document.createElement("section");
      for (let i = 0; i < 40; i++) section.appendChild(document.createElement("p"));
      scope.appendChild(section);
    };
    wave();
    await Promise.resolve();
    flushFrame();
    flushFrame(); // two quiet frames in...
    wave(); // ...a second beat cancels them and restarts the count
    await Promise.resolve();

    setPendingForTests(false);
    for (let i = 0; i < 6; i++) {
      expect(onReady).not.toHaveBeenCalled();
      flushFrame();
    }
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleAnimHoldReadiness throttled reveal", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };
  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  const shellScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  const animate = (scope: HTMLElement, names: (string | undefined)[]) => {
    (scope as unknown as { getAnimations: () => { animationName?: string }[] }).getAnimations =
      () => names.map((animationName) => (animationName ? { animationName } : {}));
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("an animated skeleton is not mistaken for a sparse screen at the grace", async () => {
    const scope = shellScope();
    animate(scope, ["skeleton-wave"]);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    // Nothing pending, nothing arrived — but the placeholders animate, so the
    // sparse-screen early exit must not fire: a throttled reveal is coming.
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).not.toHaveBeenCalled();

    // The reveal commit lands (real content de-shells the scope), then six
    // quiet frames release the motion.
    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) {
      const row = document.createElement("p");
      row.textContent = "드디어 도착한 실제 콘텐츠 행입니다";
      wave.appendChild(row);
    }
    scope.appendChild(wave);
    await Promise.resolve();
    for (let i = 0; i < 7; i++) flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("flemo's own animations do not count as placeholders", () => {
    const scope = shellScope();
    animate(scope, ["flemo-screen-cupertino-PUSHING-false"]);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a nameless (WAAPI) animation counts as a placeholder, bounded by the cap", () => {
    const scope = shellScope();
    animate(scope, [undefined]);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).not.toHaveBeenCalled();

    // Still an animated shell at the give-up deadline: the wait is state-
    // based, so the deadline keeps deferring…
    vi.advanceTimersByTime(SETTLE.firstWaitMs - SETTLE.graceMs);
    expect(onReady).not.toHaveBeenCalled();

    // …and if no reveal EVER lands, the settle cap is the bound.
    vi.advanceTimersByTime(SETTLE.capMs);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("the quiet exit re-arms while the scope is still an animated shell", async () => {
    const scope = shellScope();
    animate(scope, ["skeleton-wave"]);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    // A wave of MORE skeleton lands: quiet frames complete but the scope is
    // still an animated shell, so the gate re-arms instead of releasing into
    // the throttled reveal.
    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) wave.appendChild(document.createElement("p"));
    scope.appendChild(wave);
    await Promise.resolve();
    for (let i = 0; i < 8; i++) flushFrame();
    expect(onReady).not.toHaveBeenCalled();

    // The placeholders stop animating (state, not time): the same quiet exit
    // now releases.
    animate(scope, []);
    for (let i = 0; i < 8; i++) flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("the give-up deadline defers while the shell still animates, then fires", () => {
    const scope = shellScope();
    animate(scope, ["skeleton-wave"]);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, {
      scope,
      contentSettle: { graceMs: 10, firstWaitMs: 50, capMs: 900, minNodes: 30 }
    });
    flushFrame();
    flushFrame();

    // Deadline reached while the shell still animates: defer in 100ms steps.
    vi.advanceTimersByTime(51);
    expect(onReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onReady).not.toHaveBeenCalled();

    // The placeholders stop (still no reveal wave): the next retry gives up.
    animate(scope, []);
    vi.advanceTimersByTime(101);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleAnimHoldRelease backstop with a content settle", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  const shellScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };

  it("outlasts the settle cap instead of releasing the motion into the wave it waits out", () => {
    setPendingForTests(true);
    const release = vi.fn();
    scheduleAnimHoldRelease(release, { scope: shellScope(), contentSettle: SETTLE });
    flushFrame();
    flushFrame(); // paint anchor → the settle gate arms

    // The gate is legitimately waiting (requests in flight): the plain 300ms
    // backstop must NOT fire underneath it.
    vi.advanceTimersByTime(301);
    expect(release).not.toHaveBeenCalled();

    // The settle cap releases through the gate itself.
    vi.advanceTimersByTime(SETTLE.capMs - 301 + 1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("keeps the plain 300ms backstop when no settle is configured", () => {
    const release = vi.fn();
    scheduleAnimHoldRelease(release, {});
    vi.advanceTimersByTime(299);
    expect(release).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("still backstops a suspended tab, at the extended bound", () => {
    // rAF never fires (a backgrounded tab): the paint anchor never advances,
    // the settle gate never arms, and the extended backstop is what releases.
    setPendingForTests(true);
    const release = vi.fn();
    scheduleAnimHoldRelease(release, { scope: shellScope(), contentSettle: SETTLE });
    vi.advanceTimersByTime(SETTLE.capMs + ANIM_HOLD_RELEASE_BACKSTOP_MS - 1);
    expect(release).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("coordinator group backstop with a content settle", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  const shellScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("a founding settle member arms the group backstop at the extended bound", () => {
    setPendingForTests(true);
    const coordinator = createAnimHoldCoordinator();
    const enter = vi.fn();
    const exit = vi.fn();
    coordinator.join("PUSHING:cupertino", enter, { scope: shellScope(), contentSettle: SETTLE });
    coordinator.join("PUSHING:cupertino", exit, { decodeWait: false });

    // rAF suspended: only the backstop can release. The plain 300ms bound must
    // not fire under the settle member's legitimate wait.
    vi.advanceTimersByTime(ANIM_HOLD_RELEASE_BACKSTOP_MS + 1);
    expect(enter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SETTLE.capMs);
    expect(enter).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("a settle member joining an existing group extends the shared backstop", () => {
    setPendingForTests(true);
    const coordinator = createAnimHoldCoordinator();
    const exit = vi.fn();
    const enter = vi.fn();
    coordinator.join("PUSHING:cupertino", exit, { decodeWait: false });
    coordinator.join("PUSHING:cupertino", enter, { scope: shellScope(), contentSettle: SETTLE });

    vi.advanceTimersByTime(ANIM_HOLD_RELEASE_BACKSTOP_MS + 1);
    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SETTLE.capMs + ANIM_HOLD_RELEASE_BACKSTOP_MS);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it("a shorter member never shrinks an already-extended group backstop", () => {
    setPendingForTests(true);
    const coordinator = createAnimHoldCoordinator();
    const enter = vi.fn();
    const exit = vi.fn();
    coordinator.join("PUSHING:cupertino", enter, { scope: shellScope(), contentSettle: SETTLE });
    coordinator.join("PUSHING:cupertino", exit, { decodeWait: false });

    vi.advanceTimersByTime(ANIM_HOLD_RELEASE_BACKSTOP_MS + SETTLE.capMs - 1);
    expect(enter).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(enter).toHaveBeenCalledTimes(1);
  });
});

describe("settle gate image loads", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };
  const SETTLE = { graceMs: 150, firstWaitMs: 400, capMs: 900, minNodes: 30 };

  const shellScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 30; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  // jsdom never loads images; `complete` is emulated per test.
  const makeImage = (complete: boolean, loading?: string) => {
    const image = document.createElement("img");
    let done = complete;
    Object.defineProperty(image, "complete", { get: () => done, configurable: true });
    if (loading) Object.defineProperty(image, "loading", { value: loading, configurable: true });
    return { image, finishLoad: () => (done = true) };
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("an incomplete image holds the gate exactly like a pending request", () => {
    const scope = shellScope();
    const { image, finishLoad } = makeImage(false);
    scope.appendChild(image);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    // The sparse-screen grace must not fire while an image is still loading…
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).not.toHaveBeenCalled();

    // …and the give-up deadline defers in 100ms steps until it lands.
    vi.advanceTimersByTime(SETTLE.firstWaitMs - SETTLE.graceMs);
    expect(onReady).not.toHaveBeenCalled();

    finishLoad();
    vi.advanceTimersByTime(101);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a lazy image that never selected a source is not worth waiting on", () => {
    const scope = shellScope();
    const { image } = makeImage(false, "lazy");
    scope.appendChild(image);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("images below the scope's first screenful land invisibly and are skipped", () => {
    const scope = shellScope();
    scope.getBoundingClientRect = () => ({ top: 0, height: 800 }) as DOMRect;
    const { image } = makeImage(false);
    image.getBoundingClientRect = () => ({ top: 1200 }) as DOMRect;
    scope.appendChild(image);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("an incomplete image inside the first screenful still counts", () => {
    const scope = shellScope();
    scope.getBoundingClientRect = () => ({ top: 0, height: 800 }) as DOMRect;
    const { image } = makeImage(false);
    image.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
    scope.appendChild(image);
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("only a viewport's worth of images is considered", () => {
    const scope = shellScope();
    for (let i = 0; i < 20; i++) scope.appendChild(makeImage(true).image);
    scope.appendChild(makeImage(false).image); // the 21st — beyond the bound
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("the quiet exit re-arms until the revealed wave's images finish", async () => {
    const scope = shellScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    // The reveal lands: real content whose images are still loading.
    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) {
      const row = document.createElement("p");
      row.textContent = "이미지가 곧 도착할 콘텐츠 행입니다";
      wave.appendChild(row);
    }
    const { image, finishLoad } = makeImage(false);
    wave.appendChild(image);
    scope.appendChild(wave);
    await Promise.resolve();

    for (let i = 0; i < 8; i++) flushFrame();
    expect(onReady).not.toHaveBeenCalled();

    // The image completes: the in-progress countdown runs out and the quiet
    // exit now releases.
    finishLoad();
    for (let i = 0; i < 8; i++) flushFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

// REGRESSION (steady-60 desktop, 2026-08-17): the settle gate's wave detector
// keys on ADDED nodes, but a POP's returning screen re-uses its frozen DOM —
// the unfreeze commits almost no added nodes, so the grace/firstWait give-up
// timers were the release path and released on a wall clock while the
// unfreeze's style/layout/paint block was still due. Device-measured: every
// heavy-list pop opened with one ~50-60ms frame gap overlapping flight start.
// In render-settle mode a give-up release now requires TWO consecutive fast
// frames; a slow frame restarts the pair; capMs bounds the wait.
describe("render-settle give-up raster guard", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };
  const SETTLE = {
    graceMs: 60,
    firstWaitMs: 120,
    capMs: 700,
    minNodes: 30,
    renderSettleOnly: true
  };

  const popScope = () => {
    // A returning (already-populated) screen: content exists, no new commits.
    const scope = document.createElement("div");
    for (let i = 0; i < 10; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  const arm = () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope: popScope(), contentSettle: SETTLE });
    // The two-frame paint anchor that precedes the settle gate.
    flushFrame();
    flushFrame();
    return onReady;
  };
  const fastFrame = () => {
    vi.advanceTimersByTime(16);
    flushFrame();
  };

  it("a healthy give-up releases after two fast frames — no felt regression", () => {
    const onReady = arm();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    expect(onReady).not.toHaveBeenCalled();
    fastFrame();
    expect(onReady).not.toHaveBeenCalled();
    fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a rendering block inside the give-up window defers the release past it", () => {
    const onReady = arm();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    // Baseline fast frame, then the unfreeze's 60ms style/layout/paint block.
    fastFrame();
    vi.advanceTimersByTime(60);
    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
    // The pair restarts: one fast frame is still not enough…
    fastFrame();
    expect(onReady).not.toHaveBeenCalled();
    // …two consecutive fast frames release.
    fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a block starting AT the give-up timer defers the release — the baseline is the timer, not the first frame", () => {
    const onReady = arm();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    // The unfreeze's style/layout block runs immediately after the timer
    // fires: the FIRST guard frame arrives late and must not read as fast
    // (a null baseline would count it, halving the pair).
    vi.advanceTimersByTime(60);
    flushFrame();
    expect(onReady).not.toHaveBeenCalled();
    fastFrame();
    expect(onReady).not.toHaveBeenCalled();
    fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("capMs bounds the guard even under sustained slow frames", () => {
    const onReady = arm();
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(60);
      flushFrame();
      if (vi.mocked(onReady).mock.calls.length > 0) break;
    }
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

// A runtime without `performance` (the guards at the top of the module and
// in the give-up baseline exist for exactly this): the gate must still make
// its two-fast-frame decision off the rAF timestamps alone.
describe("render-settle give-up without a performance clock", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = (timestamp: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(timestamp));
  };
  const SETTLE = {
    graceMs: 60,
    firstWaitMs: 120,
    capMs: 700,
    minNodes: 30,
    renderSettleOnly: true
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    frames = new Map();
    frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.set(++frameId, frameCallback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames.delete(handle);
    });
    vi.stubGlobal("performance", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  it("releases on two fast frames measured off the rAF timestamps", () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 10; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    const onReady = vi.fn();

    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });
    // The two-frame paint anchor, then the give-up timer.
    flushFrame(0);
    flushFrame(16);
    vi.advanceTimersByTime(SETTLE.graceMs + 1);

    flushFrame(32);
    expect(onReady).not.toHaveBeenCalled();
    flushFrame(48);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

// THE GATE HAS TO BE WATCHING WHEN THE STORM RUNS.
//
// The settle gate used to be armed only after the paint anchor, which put the
// anchor's own two frames outside it — and those are the frames a pop's
// returning screen commits its Activity unfreeze in. The gate therefore never
// saw the very storm it exists to keep out of the motion: no wave qualified,
// every pop fell through to the grace deadline, and the release rode a wall
// clock. Watching starts with the readiness now; only the deadlines wait for
// the anchor, so their tuned windows keep their length.
describe("scheduleAnimHoldReadiness watches during the paint anchor", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };
  const SETTLE = {
    graceMs: 60,
    firstWaitMs: 120,
    capMs: 700,
    minNodes: 30,
    renderSettleOnly: true
  };

  const popScope = () => {
    const scope = document.createElement("div");
    for (let i = 0; i < 10; i++) scope.appendChild(document.createElement("div"));
    document.body.appendChild(scope);
    return scope;
  };
  const commitWave = (scope: HTMLElement) => {
    const wave = document.createElement("section");
    for (let i = 0; i < 40; i++) wave.appendChild(document.createElement("p"));
    scope.appendChild(wave);
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
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
    vi.useRealTimers();
    document.body.textContent = "";
    setPendingForTests(false);
  });

  const fastFrame = () => {
    vi.advanceTimersByTime(16);
    flushFrame();
  };

  it("sees a wave that lands DURING the anchor and waits it out instead of giving up", async () => {
    const scope = popScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope, contentSettle: SETTLE });

    // The storm commits before the anchor's two frames have run — the window
    // that used to be invisible to the gate.
    commitWave(scope);
    await Promise.resolve();
    flushFrame();
    flushFrame();

    // Past the grace, plus the two fast frames a give-up rides. That was the
    // whole release path when the wave went unseen; a seen wave owes the full
    // quiet window instead.
    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    fastFrame();
    fastFrame();
    expect(onReady).not.toHaveBeenCalled();

    for (let i = 0; i < 6; i++) fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("still gives up on the grace when the anchor really was quiet", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, { scope: popScope(), contentSettle: SETTLE });
    flushFrame();
    flushFrame();

    vi.advanceTimersByTime(SETTLE.graceMs + 1);
    fastFrame();
    fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a zero grace releases at the anchor plus the raster guard, not on a wall clock", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, {
      scope: popScope(),
      contentSettle: { ...SETTLE, graceMs: 0 }
    });
    flushFrame();
    flushFrame();

    // No wall-clock wait left to serve: the deadline is due immediately and the
    // two fast frames of the raster guard are the only thing between the anchor
    // and the release.
    vi.advanceTimersByTime(1);
    fastFrame();
    expect(onReady).not.toHaveBeenCalled();
    fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("a zero grace still waits out a block: a slow frame restarts the guard", () => {
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, {
      scope: popScope(),
      contentSettle: { ...SETTLE, graceMs: 0 }
    });
    flushFrame();
    flushFrame();

    vi.advanceTimersByTime(1);
    // The unfreeze block runs here — a 60ms frame gap. The pair restarts.
    vi.advanceTimersByTime(60);
    flushFrame();
    fastFrame();
    expect(onReady).not.toHaveBeenCalled();
    fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("the readiness needs BOTH the anchor and the gate, whichever lands last", async () => {
    const scope = popScope();
    const onReady = vi.fn();
    scheduleAnimHoldReadiness(onReady, {
      scope,
      // extraFrames pushes the anchor well past the gate, so the gate finishing
      // first must not release on its own.
      extraFrames: 6,
      contentSettle: { ...SETTLE, graceMs: 0 }
    });

    vi.advanceTimersByTime(1);
    for (let i = 0; i < 4; i++) fastFrame();
    expect(onReady).not.toHaveBeenCalled();

    for (let i = 0; i < 6; i++) fastFrame();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
