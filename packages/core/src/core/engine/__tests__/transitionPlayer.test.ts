import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VariantMotion } from "@transition/variantMotion";

import driverPolicy from "@core/engine/driverPolicy";
import {
  createTransitionPlayerRegistry,
  isPlayerDrivable,
  resetSessionOverrideCachesForTests,
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

// Advance the fake clock from `from` to `to` in pass-through (≤ 1.6 nominal
// frames) steps, landing exactly on `to`. Real rAF fires every ~16ms, so
// reaching a given progress means many small frames — any longer jump now
// reads as a main-thread STALL and resumes at one-frame cadence (see
// PASS_THROUGH_FRAMES). This walks the clock at frame cadence so the player
// advances linearly, exactly as it does under a real rAF stream.
const climbTo = (pump: (time: number) => void, from: number, to: number) => {
  let t = from;
  while (to - t > 24) {
    t += 24;
    pump(t);
  }
  pump(to);
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
    climbTo(pump, 0, 500); // halfway (linear, 1s duration) at frame cadence
    expect(entering.style.transform).toBe("translate3d(200px, 0px, 0)");
    expect(exiting.style.transform).toBe("translate3d(-70px, 0px, 0)");

    climbTo(pump, 500, 1000);
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
    climbTo(pump, 0, 500); // 50px in at frame cadence: fast → snapped
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
    climbTo(pump, 0, 500); // halfway: y is 100% of offsetHeight 800 → 400px remaining
    expect(el.style.transform).toBe(
      "translate3d(0px, 400px, 0) translateZ(4px) scale(0.75) scaleX(0.625) scaleY(0.5) " +
        "rotate(22.5deg) rotateX(5deg) rotateY(10deg)"
    );

    climbTo(pump, 500, 1000); // every channel lands on identity
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
    climbTo(pump, 0, 500);
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
    climbTo(pump, 0, 250);

    // Joins mid-flight: progress computes from the SHARED t0, so its first
    // stepped frame catches up to 50% rather than starting from 0.
    registry.join("task-1", {
      element: exiting,
      motion: linearMotion({ x: 0 }, { x: "-35%" }),
      role: "passive"
    });
    climbTo(pump, 250, 500);
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
    climbTo(pump, 0, 500); // the player advances the browser's clock, raw (uneased) time
    expect(animation.currentTime).toBe(500);
    expect(completed).toBe(0);

    climbTo(pump, 500, 1000);
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
    climbTo(pump, 0, 500);
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

describe("transitionPlayer block-resilient re-anchor", () => {
  afterEach(() => vi.restoreAllMocks());

  // opacity has no pixel snapping, so its written value is a clean, exact
  // window into progress (opacity = 1 − linear progress).
  const fadeOut = (durationSeconds: number) =>
    linearMotion({ opacity: 1 }, { opacity: 0 }, durationSeconds);
  const progressOf = (el: HTMLElement) => 1 - parseFloat(el.style.opacity);
  const ONE_FRAME_MS = 1000 / 60;

  it("a gap inside the pass-through window advances the full gap (ordinary jitter)", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", { element: el, motion: fadeOut(1), role: "active" });

    pump(0);
    pump(25); // a slightly late frame (≤1.6 nominal) → elapsed IS the gap
    expect(progressOf(el)).toBeCloseTo(25 / 1000, 5);
  });

  it("a block resumes at exactly ONE frame's step — no velocity discontinuity", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", { element: el, motion: fadeOut(1), role: "active" });

    pump(0);
    pump(90); // a 90ms block: the resume step must look like a normal frame
    expect(progressOf(el)).toBeCloseTo(ONE_FRAME_MS / 1000, 5);
  });

  it("re-anchors across a long stall: progress resumes one frame past the stall, not fast-forwarded", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    let completed = 0;

    registry.join("task-1", {
      element: el,
      motion: fadeOut(0.1), // 100ms
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });

    pump(0);
    pump(25); // normal frame → progress 0.25
    const preProgress = progressOf(el);
    expect(preProgress).toBeCloseTo(0.25, 5);

    pump(400); // 375ms stall: without re-anchor a 100ms motion would be DONE
    const postProgress = progressOf(el);
    // Resumes exactly ONE nominal frame past where it stalled, not at the end.
    expect(postProgress).toBeCloseTo(preProgress + ONE_FRAME_MS / 100, 5);
    expect(postProgress).toBeLessThan(0.7);
    expect(completed).toBe(0);

    climbTo(pump, 400, 480); // ordinary frames from here play the tail out in full
    expect(el.style.opacity).toBe("0");
    expect(completed).toBe(1);

    // Player torn down at completion: no late second onComplete.
    pump(999);
    expect(completed).toBe(1);
  });

  it("reports the RAW stall gap to the driver policy even when it re-anchors", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const reportGap = vi.spyOn(driverPolicy, "reportGap");

    registry.join("task-1", { element: el, motion: fadeOut(1), role: "active" });

    pump(0);
    pump(30);
    pump(400); // re-anchors, but the policy must still see the raw 370ms gap

    expect(reportGap.mock.calls.map(([gap]) => Math.round(gap))).toEqual([30, 370]);
  });

  it("re-anchors a scrub-WAAPI track's clock too (one shared startTime)", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 1),
      role: "active"
    });

    pump(0);
    pump(25);
    expect(animation.currentTime).toBe(25);

    pump(500); // 475ms stall → the scrub clock resumes one frame past 25, not at 500
    expect(animation.currentTime as number).toBeCloseTo(25 + ONE_FRAME_MS, 5);
  });

  it("stops cleanly when detached mid-re-anchor (task resolved by the liveness floor)", () => {
    const { scheduler, pump, pendingCount } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    let completed = 0;

    const detach = registry.join("task-1", {
      element: el,
      motion: fadeOut(1),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    })!;

    pump(0);
    pump(400); // long stall → re-anchored, still mid-flight
    expect(completed).toBe(0);
    expect(pendingCount()).toBe(1);

    // The engine's liveness floor resolved the task and its effect cleanup
    // detaches the player; the loop must stop and never complete late.
    detach();
    expect(pendingCount()).toBe(0);
    pump(9999);
    expect(completed).toBe(0);
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

describe("transitionPlayer session overrides (diagnostic instruments)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.removeItem("flemo:snap");
    sessionStorage.removeItem("flemo:apply");
    resetSessionOverrideCachesForTests();
  });

  const slide = () => linearMotion({ x: 0 }, { x: -100 }, 1);

  it("snap=always snaps even sub-device-pixel motion", () => {
    sessionStorage.setItem("flemo:snap", "always");
    resetSessionOverrideCachesForTests();
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-1", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(17); // raw -1.7px → snapped to the device grid at dpr 2
    expect(el.style.transform).toBe("translate3d(-1.5px, 0px, 0)");
  });

  it("snap=off always writes the raw sub-pixel value", () => {
    sessionStorage.setItem("flemo:snap", "off");
    resetSessionOverrideCachesForTests();
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-1", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(17);
    expect(el.style.transform).toBe("translate3d(-1.7px, 0px, 0)");
  });

  it("an unknown snap value falls back to the shipped gate", () => {
    sessionStorage.setItem("flemo:snap", "sometimes");
    resetSessionOverrideCachesForTests();
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-1", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(17); // 1.7px = 3.4 device px ≥ 1 → the normal gate snaps
    expect(el.style.transform).toBe("translate3d(-1.5px, 0px, 0)");
  });

  it("apply=scrub routes a parseable motion through the scrub driver", () => {
    sessionStorage.setItem("flemo:apply", "scrub");
    resetSessionOverrideCachesForTests();
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const animation = fakeAnimation();
    withAnimate(el, animation);
    registry.join("task-1", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(24);
    // The browser interpolates via the paused Web Animation; no per-frame
    // style writes happen.
    expect(animation.currentTime).toBe(24);
    expect(el.style.transform).toBe("");
  });

  it("a runtime without sessionStorage reads as no override", () => {
    resetSessionOverrideCachesForTests();
    vi.stubGlobal("sessionStorage", undefined);
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-1", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(17);
    expect(el.style.transform).toBe("translate3d(-1.5px, 0px, 0)");
  });

  it("a storage that throws reads as no override", () => {
    resetSessionOverrideCachesForTests();
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("storage blocked");
      }
    });
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-1", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(17);
    expect(el.style.transform).toBe("translate3d(-1.5px, 0px, 0)");
  });
});

// jsdom has no navigator.userAgentData, so these tests run as a non-Blink
// engine — the handoff's shipped default. The handoff additionally requires
// WAAPI (the scrub) and a numerically parseable motion (the remainder bake),
// so suites whose elements lack an animate stub, or whose motions are
// non-numeric, exercise the plain player untouched.
describe("anchored-opening handoff (non-Blink, diagnostic opt-in)", () => {
  beforeEach(() => {
    // The handoff is OPT-IN (mid-flight-born animations desync WebKit's
    // accelerated re-sync — see handoffOverride); these tests enable it.
    sessionStorage.setItem("flemo:handoff", "on");
    resetSessionOverrideCachesForTests();
  });
  afterEach(() => {
    sessionStorage.removeItem("flemo:handoff");
    resetSessionOverrideCachesForTests();
    vi.restoreAllMocks();
  });

  // The handoff's remainder animation, as the second element.animate call
  // returns it.
  const remainderAnimation = () => ({
    ...fakeAnimation(),
    onfinish: null as (() => void) | null
  });

  it("prefers the scrub tier for numeric motion and hands the remainder to a fresh animation", () => {
    const { scheduler, pump, pendingCount } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const remainder = remainderAnimation();
    const animate = vi.fn().mockReturnValueOnce(scrub).mockReturnValueOnce(remainder);
    el.animate = animate as unknown as typeof el.animate;
    const endRun = vi.spyOn(driverPolicy, "endRun");
    let completed = 0;

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%", opacity: 0 }, { x: 0, opacity: 1 }, 1),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(el.style.transform).toBe(""); // no numeric writes: the animation pins the frame
    expect(el.style.animation).toBe("none"); // compiled animation suppressed

    // The anchored opening: scrubbed off the player clock.
    pump(0);
    pump(24);
    pump(48);
    pump(72);
    pump(96);
    expect(scrub.currentTime).toBe(96);
    expect(scrub.canceled).toBe(false);

    // Past the opening: a FRESH animation takes the remainder — the curve's
    // tail baked into evenly-spaced keyframes over the remaining duration,
    // plain linear easing — and the scrub is cancelled in the same step.
    // Every ingredient unremarkable by design (see tryHandOff).
    pump(112);
    expect(animate).toHaveBeenCalledTimes(2);
    const [keyframes, options] = animate.mock.calls[1]! as [
      Record<string, string>[],
      KeyframeAnimationOptions
    ];
    expect(keyframes.length).toBe(41);
    // First keyframe = the pose at the handoff frame (11.2% of a linear 1s
    // slide across a 400px-wide element: 400 * (1 - 0.112) = 355.2px), last
    // keyframe = the rest pose.
    expect(keyframes[0]!.transform).toBe("translate3d(355.2px, 0px, 0)");
    expect(keyframes[0]!.opacity).toBe("0.112");
    expect(keyframes[40]!.transform).toBe("none");
    expect(keyframes[40]!.opacity).toBe("1");
    expect(options.duration).toBe(888); // 1000 - 112 already played
    expect(options.delay).toBe(0);
    expect(options.easing).toBe("linear");
    expect(options.fill).toBe("both");
    expect(scrub.canceled).toBe(true);
    expect(el.style.animation).toBe("none"); // compiled stays suppressed for the whole flight
    // The loop stops — the browser presents from here, so no frames, no
    // stall evidence, and the policy run closes once.
    expect(pendingCount()).toBe(0);
    expect(endRun).toHaveBeenCalledTimes(1);
    expect(completed).toBe(0);

    // With the compiled animation suppressed throughout, no animationend can
    // fire — the player IS the single live resolver, so the finish event
    // completes the flight here (and only once).
    remainder.onfinish?.();
    expect(completed).toBe(1);
    expect(endRun).toHaveBeenCalledTimes(1);
    remainder.onfinish?.(); // idempotent: a stray second event changes nothing
    expect(completed).toBe(1);
  });

  it("a detach after the handoff cancels the remainder and ignores a late finish", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const remainder = remainderAnimation();
    el.animate = vi
      .fn()
      .mockReturnValueOnce(scrub)
      .mockReturnValueOnce(remainder) as unknown as typeof el.animate;
    let completed = 0;

    const detach = registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }, 1),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    })!;
    pump(0);
    climbTo(pump, 0, 112); // frame-cadence past the handoff point
    expect(remainder.canceled).toBe(false);

    detach(); // interruption mid-remainder: the fill must not outlive the track
    expect(remainder.canceled).toBe(true);
    remainder.onfinish?.(); // a late finish after the detach is ignored
    expect(completed).toBe(0);
  });

  it("stays scrubbed when the remainder animation is refused", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    el.animate = vi
      .fn()
      .mockReturnValueOnce(scrub)
      .mockImplementation(() => {
        throw new Error("unsupported keyframes");
      }) as unknown as typeof el.animate;
    let completed = 0;

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }, 1),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    pump(0);
    climbTo(pump, 0, 112); // the handoff attempt throws — and is not retried
    expect(scrub.canceled).toBe(false);
    climbTo(pump, 112, 1000); // the scrub carries the whole flight
    expect(scrub.currentTime).toBe(1000);
    expect(completed).toBe(1);
  });

  it("a non-numeric motion has nothing to bake from and stays scrubbed", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const animate = withAnimate(el, scrub);
    let completed = 0;

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 1),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    pump(0);
    climbTo(pump, 0, 1000); // straight through the handoff point on the scrub path
    expect(animate).toHaveBeenCalledTimes(1); // no remainder animation was ever created
    expect(scrub.currentTime).toBe(1000);
    expect(completed).toBe(1);
  });

  it("without the opt-in the numeric tier drives (shipped default)", () => {
    sessionStorage.removeItem("flemo:handoff");
    resetSessionOverrideCachesForTests();
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const animate = withAnimate(el, fakeAnimation());

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }, 1),
      role: "active"
    });
    // Numeric motion without the handoff opt-in: the numeric tier drives,
    // no Web Animation is created at all.
    expect(animate).not.toHaveBeenCalled();
    pump(0);
    pump(500);
    expect(el.style.transform).not.toBe("");
  });
});

describe("perceptual tail cut (player clock)", () => {
  // A steep decel ease enters its imperceptibility band long before the
  // authored end — the dead sub-pixel tail the cut removes.
  const steep = (from: object, to: object): VariantMotion => ({
    from: from as VariantMotion["from"],
    to: to as VariantMotion["to"],
    duration: 1,
    delay: 0,
    ease: [0, 1, 0, 1]
  });

  it("completes the navigation at the cut, not the authored end", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    let completed = 0;
    registry.join("task-1", {
      element: el,
      motion: steep({ x: 400 }, { x: 0 }),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    pump(0);
    climbTo(pump, 0, 700); // deep inside the band for ease [0,1,0,1]
    expect(completed).toBe(1); // cut fired well before the 1000ms end
  });

  it("an unanalyzable participant vetoes the navigation's cut", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const a = element();
    const b = element();
    const animation = fakeAnimation();
    withAnimate(b, animation);
    let completed = 0;
    registry.join("task-1", {
      element: a,
      motion: steep({ x: 400 }, { x: 0 }),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    registry.join("task-1", {
      element: b,
      // clip-path: not an analyzable channel → cut unsafe → veto.
      motion: steep({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }),
      role: "passive"
    });
    pump(0);
    climbTo(pump, 0, 900);
    expect(completed).toBe(0); // no cut: the full authored span plays
    climbTo(pump, 900, 1000);
    expect(completed).toBe(1);
  });
});
