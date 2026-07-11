import { describe, expect, it, vi } from "vitest";

import type { VariantMotion } from "@transition/variantMotion";

import {
  createTransitionPlayerRegistry,
  isPlayerDrivable,
  type PlayerScheduler
} from "@core/engine/transitionPlayer";

// A hand-cranked scheduler: frames fire only when the test pumps them, with
// explicit timestamps — the player's whole clock becomes deterministic.
const createFakeScheduler = (devicePixelRatio = 1) => {
  let nextHandle = 1;
  const pending = new Map<number, (time: number) => void>();
  const scheduler: PlayerScheduler = {
    request: (callback) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    },
    cancel: (handle) => {
      pending.delete(handle);
    },
    devicePixelRatio: () => devicePixelRatio
  };
  const pump = (time: number) => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(time));
  };
  return { scheduler, pump, pendingCount: () => pending.size };
};

const element = () => {
  const el = document.createElement("div");
  Object.defineProperty(el, "offsetWidth", { value: 400, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: 800, configurable: true });
  Object.defineProperty(el, "isConnected", { value: true, configurable: true });
  document.body.appendChild(el);
  return el;
};

const linearMotion = (from: object, to: object, duration = 1): VariantMotion => ({
  from: from as VariantMotion["from"],
  to: to as VariantMotion["to"],
  duration,
  delay: 0,
  ease: "linear"
});

// Installs a WAAPI stub on the element (jsdom has none) and returns the spy.
const withAnimate = (el: HTMLElement, animation: ReturnType<typeof fakeAnimation>) => {
  const animate = vi.fn(
    (_keyframes: Keyframe[], _options: KeyframeAnimationOptions) =>
      animation as unknown as Animation
  );
  el.animate = animate;
  return animate;
};

// Minimal Web Animation stand-in for the scrub tier (jsdom has no WAAPI).
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

describe("isPlayerDrivable", () => {
  it("accepts transform + opacity + matching string templates", () => {
    expect(isPlayerDrivable(linearMotion({ x: "100%", opacity: 0 }, { x: 0, opacity: 1 }))).toBe(
      true
    );
    expect(isPlayerDrivable(linearMotion({ filter: "blur(8px)" }, { filter: "blur(0px)" }))).toBe(
      true
    );
    expect(
      isPlayerDrivable(linearMotion({ scale: 0.9, rotate: "3deg" }, { scale: 1, rotate: 0 }))
    ).toBe(true);
  });

  it("rejects mismatched string templates and unparseable transforms", () => {
    expect(
      isPlayerDrivable(linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }))
    ).toBe(false);
    expect(isPlayerDrivable(linearMotion({ x: "calc(100% - 20px)" }, { x: 0 }))).toBe(false);
    // Mixed non-zero units cannot interpolate.
    expect(isPlayerDrivable(linearMotion({ x: "50%" }, { x: "200px" }))).toBe(false);
  });

  it("rejects one-sided non-transform properties (cascade-dependent in CSS)", () => {
    expect(isPlayerDrivable(linearMotion({ x: "100%" }, { x: 0, filter: "blur(4px)" }))).toBe(
      false
    );
  });

  it("accepts string scale values and rejects unit-suffixed ones", () => {
    expect(isPlayerDrivable(linearMotion({ scale: "0.9" }, { scale: "1" }))).toBe(true);
    expect(isPlayerDrivable(linearMotion({ scale: "90%" }, { scale: "1" }))).toBe(false);
  });
});

describe("transitionPlayer", () => {
  it("pins the from frame synchronously on join and suppresses the CSS animation", () => {
    const { scheduler } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%", opacity: 0 }, { x: 0, opacity: 1 }),
      role: "active"
    });

    expect(el.style.animation).toBe("none");
    // 100% of offsetWidth 400 → 400px.
    expect(el.style.transform).toBe("translate3d(400px, 0px, 0)");
    expect(el.style.opacity).toBe("0");
  });

  it("advances all tracks off one clock and resolves the active track at the end", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const entering = element();
    const exiting = element();
    let completed = 0;

    registry.join("task-1", {
      element: entering,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    registry.join("task-1", {
      element: exiting,
      motion: linearMotion({ x: 0 }, { x: "-35%" }),
      role: "passive"
    });

    pump(0); // t0 anchor
    pump(500); // halfway (linear, 1s duration)
    expect(entering.style.transform).toBe("translate3d(200px, 0px, 0)");
    expect(exiting.style.transform).toBe("translate3d(-70px, 0px, 0)");

    pump(1000);
    // Identity collapses to "none", mirroring the compiler's rest semantics
    // (no lingering containing block at the destination).
    expect(entering.style.transform).toBe("none");
    expect(exiting.style.transform).toBe("translate3d(-140px, 0px, 0)");
    expect(completed).toBe(1);
  });

  it("snaps x/y to device pixels", () => {
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active"
    });

    pump(0);
    pump(333); // 400 * (1 - 0.333) = 266.8 → snapped to 266.5 at dpr 2
    const match = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)!;
    const value = parseFloat(match[1]!);
    expect(Math.round(value * 2)).toBe(value * 2);
  });

  it("glides sub-device-pixel motion unsnapped, re-snaps when fast", () => {
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    // Exiting-parallax shape: 100px of travel over 1s, linear.
    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: 0 }, { x: -100 }),
      role: "active"
    });

    pump(0);
    pump(500); // 50px since the pin: fast → snapped
    expect(el.style.transform).toBe("translate3d(-50px, 0px, 0)");

    pump(504); // 0.4px this frame = 0.8 device px < 1 → raw value, no step
    expect(el.style.transform).toBe("translate3d(-50.4px, 0px, 0)");

    pump(521); // 1.7px this frame = 3.4 device px → snapped again
    expect(el.style.transform).toBe("translate3d(-52px, 0px, 0)");
  });

  it("drives y/z/scale/rotate channels through one composed transform", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", {
      element: el,
      motion: linearMotion(
        {
          y: "100%",
          z: 8,
          scale: 0.5,
          scaleX: 0.25,
          scaleY: 0,
          rotate: 45,
          rotateX: 10,
          rotateY: 20
        },
        { y: 0, z: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, rotateX: 0, rotateY: 0 }
      ),
      role: "active"
    });

    pump(0);
    pump(500); // halfway: y is 100% of offsetHeight 800 → 400px remaining
    expect(el.style.transform).toBe(
      "translate3d(0px, 400px, 0) translateZ(4px) scale(0.75) scaleX(0.625) scaleY(0.5) " +
        "rotate(22.5deg) rotateX(5deg) rotateY(10deg)"
    );

    pump(1000); // every channel lands on identity
    expect(el.style.transform).toBe("none");
  });

  it("interpolates string templates positionally", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ filter: "blur(8px)" }, { filter: "blur(0px)" }),
      role: "active"
    });

    pump(0);
    pump(500);
    expect(el.style.getPropertyValue("filter")).toBe("blur(4px)");
  });

  it("writes constants once and keeps them for the whole run", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", {
      element: el,
      motion: linearMotion(
        { x: "100%", boxShadow: "-18px 0 36px rgba(0, 0, 0, 0.22)" },
        { x: 0, boxShadow: "-18px 0 36px rgba(0, 0, 0, 0.22)" }
      ),
      role: "active"
    });

    expect(el.style.getPropertyValue("box-shadow")).toBe("-18px 0 36px rgba(0, 0, 0, 0.22)");
    pump(0);
    pump(1000);
    expect(el.style.getPropertyValue("box-shadow")).toBe("-18px 0 36px rgba(0, 0, 0, 0.22)");
  });

  it("detach stops a track; the last detach cancels the frame loop", () => {
    const { scheduler, pump, pendingCount } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    const detach = registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active"
    })!;

    pump(0);
    expect(pendingCount()).toBe(1);
    detach();
    expect(pendingCount()).toBe(0);
  });

  it("late passive joiners share the active track's clock (no offset)", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const entering = element();
    const exiting = element();

    registry.join("task-1", {
      element: entering,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active"
    });
    pump(0);
    pump(250);

    // Joins mid-flight: progress computes from the SHARED t0, so its first
    // stepped frame catches up to 50% rather than starting from 0.
    registry.join("task-1", {
      element: exiting,
      motion: linearMotion({ x: 0 }, { x: "-35%" }),
      role: "passive"
    });
    pump(500);
    expect(exiting.style.transform).toBe("translate3d(-70px, 0px, 0)");
  });

  it("returns null (CSS path) for non-parseable motion when WAAPI is absent", () => {
    const { scheduler } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element(); // jsdom: no element.animate

    const detach = registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }),
      role: "active"
    });
    expect(detach).toBeNull();
    expect(el.style.animation).toBe("");
  });

  it("scrubs non-parseable motion through a paused Web Animation on the shared clock", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const animation = fakeAnimation();
    const animate = withAnimate(el, animation);
    let completed = 0;

    const detach = registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    })!;
    expect(detach).not.toBeNull();

    // Keyframes carry the raw endpoints (browser-exact interpolation), the
    // easing lives in the animation's own timing, and the compiled CSS
    // animation is suppressed while the paused fill-"both" animation pins
    // the from-state.
    expect(animate).toHaveBeenCalledWith(
      [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }],
      {
        duration: 1000,
        delay: 0,
        easing: "linear",
        fill: "both"
      }
    );
    expect(animation.paused).toBe(true);
    expect(animation.currentTime).toBe(0);
    expect(el.style.animation).toBe("none");

    pump(0);
    pump(500); // the player advances the browser's clock, raw (uneased) time
    expect(animation.currentTime).toBe(500);
    expect(completed).toBe(0);

    pump(1000);
    expect(animation.currentTime).toBe(1000);
    expect(completed).toBe(1);
    expect(animation.canceled).toBe(false); // end-state holds until detach

    detach();
    expect(animation.canceled).toBe(true); // rest rules take back over
    expect(el.style.animation).toBe("");
  });

  it("composes transform shortcuts into scrub keyframes (calc() and friends)", () => {
    const { scheduler } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const animation = fakeAnimation();
    const animate = withAnimate(el, animation);

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "calc(100% - 20px)", opacity: "0.5" }, { x: 0, opacity: "1" }),
      role: "active"
    });

    const keyframes = animate.mock.calls[0]![0] as Record<string, string>[];
    expect(keyframes[0]!.transform).toContain("calc(100% - 20px)");
    expect(keyframes[0]!.opacity).toBe("0.5");
    expect(keyframes[1]!.transform).toBe("none");
  });

  it("numeric and scrub tracks of one navigation step off the same clock", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const numericEl = element();
    const scrubEl = element();
    const animation = fakeAnimation();
    withAnimate(scrubEl, animation);

    registry.join("task-1", {
      element: numericEl,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active"
    });
    registry.join("task-1", {
      element: scrubEl,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }),
      role: "passive"
    });

    pump(0);
    pump(500);
    expect(numericEl.style.transform).toBe("translate3d(200px, 0px, 0)");
    expect(animation.currentTime).toBe(500);
  });

  it("keeps the CSS path when WAAPI rejects the keyframes", () => {
    const { scheduler } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    el.animate = vi.fn(() => {
      throw new Error("unsupported keyframes");
    });

    const detach = registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }),
      role: "active"
    });
    expect(detach).toBeNull();
    expect(el.style.animation).toBe("");
  });

  it("dispose cancels a scrub so its fill cannot outlive the player", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }),
      role: "active"
    });
    pump(0);
    registry.dispose("task-1");
    expect(animation.canceled).toBe(true);
  });

  it("dispose cancels the loop and drops the player", () => {
    const { scheduler, pump, pendingCount } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active"
    });
    pump(0);
    registry.dispose("task-1");
    expect(pendingCount()).toBe(0);
  });

  it("reports frame gaps to the observer", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const gaps: number[] = [];
    registry.onFrameGap = (gap) => gaps.push(gap);
    const el = element();

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active"
    });
    pump(0);
    pump(16.7);
    pump(83.7); // a 67ms stall
    expect(gaps.map(Math.round)).toEqual([17, 67]);
  });
});

describe("app-wide registry glue", () => {
  it("mirrors frame gaps to the window diagnostic hook (capped)", async () => {
    const { default: transitionPlayers } = await import("@core/engine/transitionPlayer");
    window.__flemoPlayerGaps = [];
    transitionPlayers.onFrameGap?.(33.33);
    expect(window.__flemoPlayerGaps).toEqual([33.3]);
    window.__flemoPlayerGaps = Array.from({ length: 700 }, () => 16.7);
    transitionPlayers.onFrameGap?.(50);
    expect(window.__flemoPlayerGaps.length).toBe(600);
    expect(window.__flemoPlayerGaps.at(-1)).toBe(50);
  });

  it("the default registry drives a real rAF track to completion", async () => {
    const { default: transitionPlayers } = await import("@core/engine/transitionPlayer");
    const el = document.createElement("div");
    document.body.appendChild(el);
    const done = new Promise<void>((resolve) => {
      transitionPlayers.join("glue-task", {
        element: el,
        motion: { from: { x: 100 }, to: { x: 0 }, duration: 0.05, delay: 0, ease: "linear" },
        role: "active",
        onComplete: resolve
      });
    });
    await done;
    expect(el.style.transform).toBe("none");
  });

  it("detaching the last track cancels the default scheduler's pending frame", async () => {
    const { default: transitionPlayers } = await import("@core/engine/transitionPlayer");
    const el = document.createElement("div");
    document.body.appendChild(el);
    const detach = transitionPlayers.join("cancel-task", {
      element: el,
      motion: { from: { x: 100 }, to: { x: 0 }, duration: 0.05, delay: 0, ease: "linear" },
      role: "active"
    })!;

    // The active join pinned the from frame and scheduled a real rAF; a
    // synchronous detach must strip the pin AND cancel that pending frame.
    detach();
    expect(el.style.transform).toBe("");
    expect(el.style.animation).toBe("");
  });
});
