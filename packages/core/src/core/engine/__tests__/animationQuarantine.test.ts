import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QUARANTINE_ATTR } from "@transition/compileTransitionStyles";

import createAnimationQuarantine from "@core/engine/animationQuarantine";

// jsdom has no Web Animations API, so the enumeration surface is stubbed per
// test: `scope.getAnimations` returns handcrafted CSSAnimation-shaped
// objects. That is the exact contract the module consumes.

interface FakeAnimationInit {
  animationName: string;
  target: Element;
  pseudoElement?: string | null;
  playState?: string;
  firstKeyframe?: Record<string, string | number>;
  currentTime?: number | null;
  seekThrows?: boolean;
}

const fakeAnimation = (init: FakeAnimationInit) => {
  const animation = {
    animationName: init.animationName,
    playState: init.playState ?? "running",
    effect: {
      target: init.target,
      pseudoElement: init.pseudoElement ?? null,
      getKeyframes: () => [
        {
          offset: 0,
          computedOffset: 0,
          easing: "ease",
          composite: "replace",
          ...init.firstKeyframe
        }
      ]
    },
    _currentTime: init.currentTime ?? null
  };
  Object.defineProperty(animation, "currentTime", {
    get: () => animation._currentTime,
    set: (value: number) => {
      if (init.seekThrows) throw new DOMException("InvalidState");
      animation._currentTime = value;
    }
  });
  return animation as unknown as Animation;
};

const stubAnimations = (scope: HTMLElement, batches: Animation[][]) => {
  let call = 0;
  Object.defineProperty(scope, "getAnimations", {
    configurable: true,
    value: vi.fn(() => batches[Math.min(call++, batches.length - 1)] ?? [])
  });
};

describe("createAnimationQuarantine", () => {
  let scope: HTMLElement;

  beforeEach(() => {
    scope = document.createElement("div");
    document.body.appendChild(scope);
  });

  afterEach(() => {
    scope.remove();
    vi.restoreAllMocks();
  });

  it("stamps and lifts the quarantine attribute without Web Animations support (degraded path)", () => {
    const release = createAnimationQuarantine(scope);
    expect(scope.getAttribute(QUARANTINE_ATTR)).toBe("true");
    release();
    expect(scope.hasAttribute(QUARANTINE_ATTR)).toBe(false);
  });

  it("pins a real-element target to its first-keyframe pose and restores prior inline values", () => {
    const skeleton = document.createElement("div");
    skeleton.style.setProperty("opacity", "0.5");
    scope.appendChild(skeleton);
    stubAnimations(scope, [
      [
        fakeAnimation({
          animationName: "skeleton-reveal",
          target: skeleton,
          firstKeyframe: { opacity: "0" }
        })
      ],
      []
    ]);

    const release = createAnimationQuarantine(scope);
    // The flight presents the authored t≈0 pose, not the base styles.
    expect(skeleton.style.getPropertyValue("opacity")).toBe("0");
    release();
    // The pin is the quarantine's, not the consumer's: the prior inline value
    // comes back at the landing.
    expect(skeleton.style.getPropertyValue("opacity")).toBe("0.5");
  });

  it("hyphenates camelCase keyframe properties for the inline pin", () => {
    const badge = document.createElement("div");
    scope.appendChild(badge);
    stubAnimations(scope, [
      [
        fakeAnimation({
          animationName: "badge-pop",
          target: badge,
          firstKeyframe: { backgroundColor: "rgb(255, 0, 0)" }
        })
      ],
      []
    ]);

    const release = createAnimationQuarantine(scope);
    expect(badge.style.getPropertyValue("background-color")).toBe("rgb(255, 0, 0)");
    release();
    expect(badge.style.getPropertyValue("background-color")).toBe("");
  });

  it("never touches flemo's own compiled animations, the scope, parts, or pseudo-elements", () => {
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", "bar-title");
    scope.appendChild(part);
    const shimmerHost = document.createElement("div");
    scope.appendChild(shimmerHost);
    stubAnimations(scope, [
      [
        fakeAnimation({
          animationName: "flemo-screen-cupertino-PUSHING-true",
          target: scope,
          firstKeyframe: { opacity: "0" }
        }),
        fakeAnimation({
          animationName: "part-anim",
          target: part,
          firstKeyframe: { opacity: "0" }
        }),
        fakeAnimation({
          animationName: "shimmer",
          target: shimmerHost,
          pseudoElement: "::after",
          firstKeyframe: { transform: "translateX(-100%)" }
        })
      ],
      []
    ]);

    const release = createAnimationQuarantine(scope);
    expect(scope.style.getPropertyValue("opacity")).toBe("");
    expect(part.style.getPropertyValue("opacity")).toBe("");
    // Pseudo targets can't take an inline pin; the compiled rule's plain
    // suppression covers them.
    expect(shimmerHost.style.getPropertyValue("transform")).toBe("");
    release();
  });

  it("skips the pin when the first keyframe is not at offset 0", () => {
    const late = document.createElement("div");
    scope.appendChild(late);
    const animation = fakeAnimation({ animationName: "late", target: late });
    (animation as unknown as { effect: { getKeyframes: () => unknown[] } }).effect.getKeyframes =
      () => [{ offset: 0.5, computedOffset: 0.5, easing: "ease", opacity: "0" }];
    stubAnimations(scope, [[animation], []]);

    const release = createAnimationQuarantine(scope);
    expect(late.style.getPropertyValue("opacity")).toBe("");
    release();
  });

  it("pins a no-delay short one-shot to its END pose (ran-instantly), delayed reveals to FROM", () => {
    const entrance = document.createElement("div");
    scope.appendChild(entrance);
    const gated = document.createElement("div");
    scope.appendChild(gated);
    const withTiming = (
      init: Parameters<typeof fakeAnimation>[0],
      timing: object,
      lastFrame?: object
    ) => {
      const animation = fakeAnimation(init);
      const effect = (animation as unknown as { effect: Record<string, unknown> }).effect;
      effect.getTiming = () => timing;
      if (lastFrame) {
        const firstFrame = (effect.getKeyframes as () => object[])()[0];
        effect.getKeyframes = () => [firstFrame, lastFrame];
      }
      return animation;
    };
    stubAnimations(scope, [
      [
        withTiming(
          { animationName: "instant-fade", target: entrance, firstKeyframe: { opacity: "0" } },
          { delay: 0, duration: 180, iterations: 1 },
          { offset: 1, computedOffset: 1, easing: "ease", opacity: "1" }
        ),
        withTiming(
          { animationName: "delayed-reveal", target: gated, firstKeyframe: { opacity: "0" } },
          { delay: 500, duration: 180, iterations: 1 }
        )
      ],
      []
    ]);

    const release = createAnimationQuarantine(scope);
    expect(entrance.style.getPropertyValue("opacity")).toBe("1"); // end pose
    expect(gated.style.getPropertyValue("opacity")).toBe("0"); // authored hidden
    release();
  });

  it("rejoins every snapshotted animation to its original clock at the release", () => {
    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValue(1000);
    const skeleton = document.createElement("div");
    scope.appendChild(skeleton);
    const shimmerHost = document.createElement("div");
    scope.appendChild(shimmerHost);
    const respawnedReveal = fakeAnimation({ animationName: "skeleton-reveal", target: skeleton });
    const respawnedShimmer = fakeAnimation({
      animationName: "shimmer",
      target: shimmerHost,
      pseudoElement: "::after"
    });
    stubAnimations(scope, [
      [
        fakeAnimation({
          animationName: "skeleton-reveal",
          target: skeleton,
          firstKeyframe: { opacity: "0" }
        }),
        fakeAnimation({ animationName: "shimmer", target: shimmerHost, pseudoElement: "::after" })
      ],
      [respawnedReveal, respawnedShimmer]
    ]);

    const release = createAnimationQuarantine(scope);
    nowSpy.mockReturnValue(1350);
    release();
    // As if it had been running since mount: no restart, no re-delay. The
    // delayed reveal is still inside its authored 500ms window and fires at
    // the authored absolute time.
    expect(respawnedReveal.currentTime).toBe(350);
    // Pseudo-element animations rejoin too — a loop lands mid-phase instead
    // of restarting at the landing.
    expect(respawnedShimmer.currentTime).toBe(350);
  });

  it("leaves authored-paused animations, disconnected targets, and rejected seeks alone", () => {
    const paused = document.createElement("div");
    scope.appendChild(paused);
    const doomed = document.createElement("div");
    scope.appendChild(doomed);
    const brittle = document.createElement("div");
    scope.appendChild(brittle);
    const respawnedPaused = fakeAnimation({ animationName: "paused-anim", target: paused });
    const respawnedBrittle = fakeAnimation({
      animationName: "brittle-anim",
      target: brittle,
      seekThrows: true
    });
    stubAnimations(scope, [
      [
        fakeAnimation({ animationName: "paused-anim", target: paused, playState: "paused" }),
        fakeAnimation({ animationName: "doomed-anim", target: doomed }),
        fakeAnimation({ animationName: "brittle-anim", target: brittle })
      ],
      [respawnedPaused, respawnedBrittle]
    ]);

    const release = createAnimationQuarantine(scope);
    doomed.remove();
    expect(() => release()).not.toThrow();
    // An authored pause IS the author's pose — never seeked to the clock.
    expect(respawnedPaused.currentTime).toBeNull();
  });

  it("ignores non-CSS animations, effect-less animations, and non-style keyframe values", () => {
    const waapiTarget = document.createElement("div");
    scope.appendChild(waapiTarget);
    const mixed = document.createElement("div");
    scope.appendChild(mixed);
    const waapiAnimation = {
      // No animationName: a WAAPI-created animation, not a CSS one.
      playState: "running",
      effect: { target: waapiTarget, pseudoElement: null, getKeyframes: () => [] }
    } as unknown as Animation;
    const orphanAnimation = {
      animationName: "orphan",
      playState: "running",
      effect: null
    } as unknown as Animation;
    stubAnimations(scope, [
      [
        waapiAnimation,
        orphanAnimation,
        fakeAnimation({
          animationName: "mixed-values",
          target: mixed,
          firstKeyframe: { opacity: "0", weird: undefined as unknown as string }
        })
      ],
      []
    ]);

    const release = createAnimationQuarantine(scope);
    // Only the parsable string/number values pin; the rest are skipped, and
    // the unidentifiable animations contribute nothing.
    expect(mixed.style.getPropertyValue("opacity")).toBe("0");
    expect(waapiTarget.getAttribute("style")).toBeNull();
    expect(() => release()).not.toThrow();
  });

  it("treats a keyframe without offset metadata as the t≈0 pose", () => {
    const bare = document.createElement("div");
    scope.appendChild(bare);
    const animation = fakeAnimation({ animationName: "bare", target: bare });
    (animation as unknown as { effect: { getKeyframes: () => unknown[] } }).effect.getKeyframes =
      () => [{ opacity: "0" }];
    stubAnimations(scope, [[animation], []]);

    const release = createAnimationQuarantine(scope);
    expect(bare.style.getPropertyValue("opacity")).toBe("0");
    release();
  });

  it("starts unsnapshotted (mid-flight-arrived) animations fresh at the landing", () => {
    const arrived = document.createElement("div");
    scope.appendChild(arrived);
    const lateAnimation = fakeAnimation({ animationName: "arrived-anim", target: arrived });
    stubAnimations(scope, [[], [lateAnimation]]);

    const release = createAnimationQuarantine(scope);
    release();
    // Begin-at-arrival: nothing rejoins an animation born after the mount.
    expect(lateAnimation.currentTime).toBeNull();
  });
});
