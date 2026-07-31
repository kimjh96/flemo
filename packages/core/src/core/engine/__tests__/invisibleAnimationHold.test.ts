import { describe, expect, it, vi } from "vitest";

import createInvisibleAnimationHold, {
  MAX_HELD_ANIMATIONS
} from "@core/engine/invisibleAnimationHold";

// jsdom has no getAnimations; the module duck-types the Web Animations
// surface, so tests fabricate it.
const fakeAnimation = (
  target: unknown,
  overrides: {
    name?: string;
    playState?: AnimationPlayState;
    failPause?: boolean;
    failPlay?: boolean;
  } = {}
) => {
  const animation = {
    animationName: overrides.name ?? "skeleton-wave",
    playState: overrides.playState ?? "running",
    effect: { target },
    pause: vi.fn(() => {
      if (overrides.failPause) throw new Error("dead");
      (animation as { playState: AnimationPlayState }).playState = "paused";
    }),
    play: vi.fn(() => {
      if (overrides.failPlay) throw new Error("dead");
      (animation as { playState: AnimationPlayState }).playState = "running";
    })
  };
  return animation as unknown as Animation & { pause: ReturnType<typeof vi.fn> };
};

const scopeWith = (animations: Animation[]) => {
  const scope = document.createElement("div");
  document.body.appendChild(scope);
  (scope as { getAnimations?: () => Animation[] }).getAnimations = () => animations;
  return scope;
};

const invisibleChild = (scope: HTMLElement) => {
  const section = document.createElement("section");
  section.style.opacity = "0";
  scope.appendChild(section);
  const inner = document.createElement("span");
  section.appendChild(inner);
  return { section, inner };
};

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

describe("createInvisibleAnimationHold", () => {
  it("pauses an invisible animation on the first frame and resumes it at release", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    const animation = fakeAnimation(section);
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [animation];
    const release = createInvisibleAnimationHold(scope);
    // The arming commit's styles apply after the call: nothing yet.
    expect(animation.pause).not.toHaveBeenCalled();
    await nextFrame();
    expect(animation.pause).toHaveBeenCalledOnce();
    expect(animation.playState).toBe("paused");
    release();
    expect(animation.playState).toBe("running");
    scope.remove();
  });

  it("holds an animation whose INVISIBILITY comes from an ancestor inside the scope", async () => {
    const scope = scopeWith([]);
    const { inner } = invisibleChild(scope);
    const animation = fakeAnimation(inner);
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [animation];
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    expect(animation.pause).toHaveBeenCalledOnce();
    release();
    scope.remove();
  });

  it("never touches a visible animation, flemo's own, a non-running one, or a detached target", async () => {
    const scope = scopeWith([]);
    const visible = document.createElement("section");
    scope.appendChild(visible);
    const { section } = invisibleChild(scope);
    const visibleAnimation = fakeAnimation(visible);
    const flemoOwn = fakeAnimation(section, { name: "flemo-screen-cupertino-PUSHING-true" });
    const alreadyPaused = fakeAnimation(section, { playState: "paused" });
    const finished = fakeAnimation(section, { playState: "finished" });
    const noTarget = fakeAnimation(null);
    const animations = [visibleAnimation, flemoOwn, alreadyPaused, finished, noTarget];
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => animations;
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    for (const animation of animations) {
      expect((animation as { pause: ReturnType<typeof vi.fn> }).pause).not.toHaveBeenCalled();
    }
    release();
    scope.remove();
  });

  it("catches a mid-flight restart through its mutation watcher (the parked-skeleton case)", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    // A nameless (WAAPI) animation held from the start; the rescan must skip
    // it (already held) while catching the newcomer.
    const initial = fakeAnimation(section, { name: undefined });
    Object.assign(initial, { animationName: undefined });
    const animations: Animation[] = [initial];
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => animations;
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    expect(initial.pause).toHaveBeenCalledOnce();

    // The park re-inserts a skeleton: a fresh running animation appears with
    // a childList commit.
    const restarted = fakeAnimation(section);
    animations.push(restarted);
    scope.appendChild(document.createElement("i"));
    await nextFrame();
    await nextFrame();
    expect(initial.pause).toHaveBeenCalledOnce();
    expect(restarted.pause).toHaveBeenCalledOnce();
    release();
    expect(restarted.playState).toBe("running");
    scope.remove();
  });

  it("coalesces a commit arriving before the scheduled scan into the same frame", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    const animation = fakeAnimation(section);
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [animation];
    const release = createInvisibleAnimationHold(scope);
    // The observer delivers before the creation-scheduled frame runs.
    scope.appendChild(document.createElement("i"));
    await nextFrame();
    expect(animation.pause).toHaveBeenCalledOnce();
    release();
    scope.remove();
  });

  it("still scans without MutationObserver (only commit coverage is lost)", async () => {
    const originalObserver = globalThis.MutationObserver;
    // @ts-expect-error -- simulating a minimal DOM
    delete globalThis.MutationObserver;
    try {
      const scope = scopeWith([]);
      const { section } = invisibleChild(scope);
      const animation = fakeAnimation(section);
      (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [animation];
      const release = createInvisibleAnimationHold(scope);
      await nextFrame();
      expect(animation.pause).toHaveBeenCalledOnce();
      release();
      scope.remove();
    } finally {
      globalThis.MutationObserver = originalObserver;
    }
  });

  it("a release survives animations that died during the flight", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    const dying = fakeAnimation(section, { failPlay: true });
    const healthy = fakeAnimation(section);
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [dying, healthy];
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    expect(() => release()).not.toThrow();
    expect(healthy.playState).toBe("running");
    scope.remove();
  });

  it("skips an animation whose pause throws (already dead)", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    const dead = fakeAnimation(section, { failPause: true });
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [dead];
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    expect(dead.playState).toBe("running");
    release();
    scope.remove();
  });

  it("caps the held animations at MAX_HELD_ANIMATIONS", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    const animations = Array.from({ length: MAX_HELD_ANIMATIONS + 8 }, () =>
      fakeAnimation(section)
    );
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => animations;
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    const paused = animations.filter((a) => a.playState === "paused");
    expect(paused.length).toBe(MAX_HELD_ANIMATIONS);
    release();
    scope.remove();
  });

  it("stops watching once released", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    const animations: Animation[] = [];
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => animations;
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    release();
    const late = fakeAnimation(section);
    animations.push(late);
    scope.appendChild(document.createElement("i"));
    await nextFrame();
    await nextFrame();
    expect(late.pause).not.toHaveBeenCalled();
    scope.remove();
  });

  it("cancels a scheduled first scan when released before the frame", async () => {
    const scope = scopeWith([]);
    const { section } = invisibleChild(scope);
    const animation = fakeAnimation(section);
    (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [animation];
    const release = createInvisibleAnimationHold(scope);
    release();
    await nextFrame();
    expect(animation.pause).not.toHaveBeenCalled();
    scope.remove();
  });

  it("is a no-op where getAnimations does not exist (jsdom/SSR)", () => {
    const scope = document.createElement("div");
    expect(() => createInvisibleAnimationHold(scope)()).not.toThrow();
  });

  it("treats a viewless document as visible (nothing to reason about)", async () => {
    const detachedDocument = document.implementation.createHTMLDocument("x");
    const el = detachedDocument.createElement("section");
    detachedDocument.body.appendChild(el);
    const animation = fakeAnimation(el);
    const scope = scopeWith([animation]);
    const release = createInvisibleAnimationHold(scope);
    await nextFrame();
    expect(animation.pause).not.toHaveBeenCalled();
    release();
    scope.remove();
  });

  it("scans immediately where requestAnimationFrame does not exist", () => {
    const originalRaf = globalThis.requestAnimationFrame;
    // @ts-expect-error -- simulating the SSR edge
    delete globalThis.requestAnimationFrame;
    try {
      const scope = scopeWith([]);
      const { section } = invisibleChild(scope);
      const animation = fakeAnimation(section);
      (scope as { getAnimations?: () => Animation[] }).getAnimations = () => [animation];
      const release = createInvisibleAnimationHold(scope);
      expect(animation.pause).toHaveBeenCalledOnce();
      release();
      scope.remove();
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
    }
  });
});
