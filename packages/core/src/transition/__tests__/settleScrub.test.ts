import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CssDecl } from "@transition/compileTransitionStyles";

import { createSettleScrubber, type SettleScheduler } from "@transition/settleScrub";

const createFakeScheduler = () => {
  let nextHandle = 1;
  const pending = new Map<number, (time: number) => void>();
  const scheduler: SettleScheduler = {
    request: (callback) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    },
    cancel: (handle) => {
      pending.delete(handle);
    }
  };
  const pump = (time: number) => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(time));
  };
  return { scheduler, pump, pendingCount: () => pending.size };
};

const fakeAnimation = () => ({
  currentTime: null as number | null,
  paused: false,
  canceled: false,
  pause() {
    this.paused = true;
  },
  cancel() {
    this.canceled = true;
  }
});

const withAnimate = (el: HTMLElement, animation: ReturnType<typeof fakeAnimation>) => {
  const animate = vi.fn(
    (_keyframes: Keyframe[], _options: KeyframeAnimationOptions) =>
      animation as unknown as Animation
  );
  el.animate = animate;
  return animate;
};

const element = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

const inlineWriter = (el: HTMLElement) => (decl: CssDecl) =>
  el.style.setProperty(decl.property, decl.value);

describe("settleScrub", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a paused single-keyframe animation (implicit from = current value)", () => {
    const { scheduler } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    const animation = fakeAnimation();
    const animate = withAnimate(el, animation);

    const promise = scrubber.settle(
      el,
      [{ property: "transform", value: "translate3d(0px, 0px, 0)" }],
      { durationMs: 300, delayMs: 0, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
      inlineWriter(el)
    );

    expect(promise).not.toBeNull();
    expect(animate).toHaveBeenCalledWith([{ transform: "translate3d(0px, 0px, 0)" }], {
      duration: 300,
      delay: 0,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "forwards"
    });
    expect(animation.paused).toBe(true);
    expect(animation.currentTime).toBe(0);
  });

  it("scrubs currentTime off the shared clock and finalizes inline at the end", async () => {
    const { scheduler, pump, pendingCount } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);
    let resolved = false;

    const promise = scrubber.settle(
      el,
      [{ property: "transform", value: "translate3d(0px, 0px, 0)" }],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      inlineWriter(el)
    )!;
    void promise.then(() => {
      resolved = true;
    });

    pump(0); // t0 anchor
    pump(150);
    expect(animation.currentTime).toBe(150);
    expect(resolved).toBe(false);

    pump(300); // destination: final values land INLINE, the animation drops
    await promise;
    expect(resolved).toBe(true);
    expect(el.style.transform).toBe("translate3d(0px, 0px, 0)");
    expect(animation.canceled).toBe(true);
    expect(pendingCount()).toBe(0); // clock stops when nothing settles
  });

  it("settles issued in the same burst share one clock", () => {
    const { scheduler, pump } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const a = element();
    const b = element();
    const animationA = fakeAnimation();
    const animationB = fakeAnimation();
    withAnimate(a, animationA);
    withAnimate(b, animationB);

    const timing = { durationMs: 300, delayMs: 0, easing: "linear" };
    scrubber.settle(a, [{ property: "opacity", value: "1" }], timing, inlineWriter(a));
    scrubber.settle(b, [{ property: "opacity", value: "0" }], timing, inlineWriter(b));

    pump(0);
    pump(100);
    expect(animationA.currentTime).toBe(100);
    expect(animationB.currentTime).toBe(100);
  });

  it("takeover pins the current computed values inline and drops the animation", () => {
    const { scheduler, pump } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    el.style.opacity = "0.5"; // what getComputedStyle reports mid-settle here
    const animation = fakeAnimation();
    withAnimate(el, animation);
    const writes: CssDecl[] = [];

    scrubber.settle(
      el,
      [{ property: "opacity", value: "0" }],
      {
        durationMs: 300,
        delayMs: 0,
        easing: "linear"
      },
      (decl) => writes.push(decl)
    );
    pump(0);
    pump(100);

    scrubber.takeover(el);
    expect(animation.canceled).toBe(true);
    expect(writes).toEqual([{ property: "opacity", value: "0.5" }]);
  });

  it("takeover skips properties the computed style cannot report", () => {
    const { scheduler, pump } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    el.style.opacity = "0.5";
    const animation = fakeAnimation();
    withAnimate(el, animation);
    const writes: CssDecl[] = [];

    // An unset custom property has no computed value (""): the pin must
    // write what it can read and silently skip the rest.
    scrubber.settle(
      el,
      [
        { property: "opacity", value: "0" },
        { property: "--flemo-probe", value: "1" }
      ],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      (decl) => writes.push(decl)
    );
    pump(0);
    pump(100);

    scrubber.takeover(el);
    expect(writes).toEqual([{ property: "opacity", value: "0.5" }]);
  });

  it("takeover on a disconnected settling element concludes without writing", async () => {
    const { scheduler, pump } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);
    const writes: CssDecl[] = [];

    const promise = scrubber.settle(
      el,
      [{ property: "opacity", value: "0" }],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      (decl) => writes.push(decl)
    )!;
    pump(0);
    el.remove();

    scrubber.takeover(el);
    await promise;
    expect(writes).toEqual([]);
    expect(animation.canceled).toBe(true);
  });

  it("a re-settle on the same element replaces the previous one", async () => {
    const { scheduler, pump } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    const first = fakeAnimation();
    withAnimate(el, first);
    const firstPromise = scrubber.settle(
      el,
      [{ property: "opacity", value: "0" }],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      inlineWriter(el)
    )!;
    pump(0);

    const second = fakeAnimation();
    withAnimate(el, second);
    scrubber.settle(
      el,
      [{ property: "opacity", value: "1" }],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      inlineWriter(el)
    );

    await firstPromise; // the replaced settle resolves instead of hanging
    expect(first.canceled).toBe(true);
    expect(second.canceled).toBe(false);
  });

  it("cancel drops a settle without writing anything", async () => {
    const { scheduler, pump, pendingCount } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);
    const writes: CssDecl[] = [];

    const promise = scrubber.settle(
      el,
      [{ property: "opacity", value: "0" }],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      (decl) => writes.push(decl)
    )!;
    pump(0);
    pump(100);

    scrubber.cancel(el);
    await promise; // resolves so a swipe handler's await never hangs
    expect(writes).toEqual([]);
    expect(animation.canceled).toBe(true);
    expect(pendingCount()).toBe(0);

    // No-op on non-settling elements.
    expect(() => scrubber.cancel(element())).not.toThrow();
  });

  it("returns null without WAAPI or when the keyframe is rejected", () => {
    const { scheduler } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const bare = element(); // jsdom: no element.animate

    expect(
      scrubber.settle(
        bare,
        [{ property: "opacity", value: "0" }],
        {
          durationMs: 300,
          delayMs: 0,
          easing: "linear"
        },
        inlineWriter(bare)
      )
    ).toBeNull();

    const throwing = element();
    throwing.animate = vi.fn(() => {
      throw new Error("rejected keyframes");
    });
    expect(
      scrubber.settle(
        throwing,
        [{ property: "opacity", value: "0" }],
        {
          durationMs: 300,
          delayMs: 0,
          easing: "linear"
        },
        inlineWriter(throwing)
      )
    ).toBeNull();
  });

  it("the backstop finalizes when frames never come (backgrounded tab)", async () => {
    const { scheduler } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);

    const promise = scrubber.settle(
      el,
      [{ property: "opacity", value: "0" }],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      inlineWriter(el)
    )!;

    vi.advanceTimersByTime(360);
    await promise;
    expect(el.style.opacity).toBe("0");
    expect(animation.canceled).toBe(true);
  });

  it("a disconnected element finalizes without writing", async () => {
    const { scheduler, pump } = createFakeScheduler();
    const scrubber = createSettleScrubber(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);
    const writes: CssDecl[] = [];

    const promise = scrubber.settle(
      el,
      [{ property: "opacity", value: "0" }],
      { durationMs: 300, delayMs: 0, easing: "linear" },
      (decl) => writes.push(decl)
    )!;
    pump(0);
    el.remove();
    pump(300);

    await promise;
    expect(writes).toEqual([]);
    expect(animation.canceled).toBe(true);
  });
});
