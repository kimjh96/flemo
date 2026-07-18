import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { VariantMotion } from "@transition/variantMotion";

import driverPolicy from "@core/engine/driverPolicy";
import {
  createTransitionPlayerRegistry,
  isPlayerDrivable,
  TAKEOVER_HEALTHY_GAP_MS,
  TAKEOVER_PROBE_FRAMES,
  type PlayerScheduler
} from "@core/engine/transitionPlayer";

// These suites exercise the player's DRIVING mechanics, so they pin the
// diagnostic force key: a pin skips the health-gated takeover probe (a pin
// means no automatic decisions), giving every join the immediate takeover the
// assertions were written against. The gate itself is tested un-pinned in the
// "health-gated takeover" suite below.
beforeAll(() => localStorage.setItem("flemo:motion-driver-force", "raf"));
afterAll(() => localStorage.removeItem("flemo:motion-driver-force"));

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

// Advance the fake clock from `from` to `to` in sub-threshold (<100ms) steps,
// landing exactly on `to`. Real rAF fires every ~16ms, so reaching a given
// progress means many small frames — a single 250/500ms jump would now read as
// a main-thread STALL and re-anchor. This walks the clock at frame cadence so
// the player advances linearly, exactly as it does under a real rAF stream.
const climbTo = (pump: (time: number) => void, from: number, to: number) => {
  let t = from;
  while (to - t > 80) {
    t += 80;
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

// Installs a WAAPI stub on the element (jsdom has none). Mints a FRESH
// animation per call, matching the real element.animate: the registry
// validates the scrub tier at join with a throwaway creation (cancelled
// immediately) and creates the LIVE animation at activation — assertions about
// the driving animation target `live()`, the last instance.
const withAnimate = (el: HTMLElement) => {
  const animations: ReturnType<typeof fakeAnimation>[] = [];
  const animate = vi.fn((_keyframes: Keyframe[], _options: KeyframeAnimationOptions) => {
    const animation = fakeAnimation();
    animations.push(animation);
    return animation as unknown as Animation;
  });
  el.animate = animate;
  return { animate, live: () => animations[animations.length - 1]! };
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
    const { animate, live } = withAnimate(el);
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
    expect(live().paused).toBe(true);
    expect(live().currentTime).toBe(0);
    expect(el.style.animation).toBe("none");

    pump(0);
    climbTo(pump, 0, 500); // the player advances the browser's clock, raw (uneased) time
    expect(live().currentTime).toBe(500);
    expect(completed).toBe(0);

    climbTo(pump, 500, 1000);
    expect(live().currentTime).toBe(1000);
    expect(completed).toBe(1);
    expect(live().canceled).toBe(false); // end-state holds until detach

    detach();
    expect(live().canceled).toBe(true); // rest rules take back over
    expect(el.style.animation).toBe("");
  });

  it("composes transform shortcuts into scrub keyframes (calc() and friends)", () => {
    const { scheduler } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const { animate } = withAnimate(el);

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
    const { live } = withAnimate(scrubEl);

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
    expect(live().currentTime).toBe(500);
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
    const { live } = withAnimate(el);

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }),
      role: "active"
    });
    pump(0);
    registry.dispose("task-1");
    expect(live().canceled).toBe(true);
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

  it("advances normally when the frame gap is below the re-anchor threshold", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", { element: el, motion: fadeOut(1), role: "active" });

    pump(0);
    pump(90); // 90ms < 100ms threshold → elapsed IS the gap, no shift
    expect(progressOf(el)).toBeCloseTo(90 / 1000, 5);
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
    pump(30); // normal frame → progress 0.30
    const preProgress = progressOf(el);
    expect(preProgress).toBeCloseTo(0.3, 5);

    pump(400); // 370ms stall: without re-anchor a 100ms motion would be DONE
    const postProgress = progressOf(el);
    // Resumes one nominal frame past where it stalled, not at the end.
    expect(postProgress).toBeCloseTo(preProgress + ONE_FRAME_MS / 100, 5);
    expect(postProgress).toBeLessThan(0.6);
    expect(completed).toBe(0);

    pump(454); // 100ms of RE-ANCHORED elapsed reaches the true end
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
    const { live } = withAnimate(el);

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 1),
      role: "active"
    });

    pump(0);
    pump(40);
    expect(live().currentTime).toBe(40);

    pump(500); // 460ms stall → the scrub clock resumes near 40 + one frame, not 500
    expect(live().currentTime as number).toBeCloseTo(40 + ONE_FRAME_MS, 5);
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

describe("health-gated takeover (un-pinned)", () => {
  // Without a diagnostic pin, the player must EARN the takeover: the compiled
  // CSS animation drives from the release, a short rAF probe measures the
  // main thread, and only TAKEOVER_PROBE_FRAMES healthy gaps hand over the
  // motion. A contended probe declines and the compositor keeps driving.
  const unpin = () => localStorage.removeItem("flemo:motion-driver-force");
  const repin = () => localStorage.setItem("flemo:motion-driver-force", "raf");

  it("declines on a contended probe: the compiled animation is never touched", () => {
    unpin();
    try {
      const { scheduler, pump, pendingCount } = createFakeScheduler();
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();

      registry.join("gate-decline", {
        element: el,
        motion: linearMotion({ x: 100 }, { x: 0 }, 0.6),
        role: "active"
      });
      // Join must NOT suppress the compiled animation while probing.
      expect(el.style.animation).toBe("");
      expect(el.style.transform).toBe("");

      pump(0); // origin frame
      // One frame past the health bound = a main-thread block: decline.
      pump(TAKEOVER_HEALTHY_GAP_MS + 20);
      expect(el.style.animation).toBe("");
      expect(el.style.transform).toBe("");
      // Declined for good: no further frames are scheduled.
      expect(pendingCount()).toBe(0);
    } finally {
      repin();
    }
  });

  it("takes over after healthy probe frames, continuing the motion's progress", () => {
    unpin();
    try {
      const { scheduler, pump } = createFakeScheduler();
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();

      registry.join("gate-takeover", {
        element: el,
        // 1s linear x: 100 -> 0.
        motion: linearMotion({ x: 100 }, { x: 0 }, 1),
        role: "active"
      });

      pump(0); // origin frame (origin back-dated one nominal frame)
      for (let i = 1; i <= TAKEOVER_PROBE_FRAMES; i++) pump(i * 16);
      // Activated: compiled animation suppressed, and the first write lands at
      // the CURRENT progress (~48+16ms elapsed of 1000ms), never back at 100px.
      expect(el.style.animation).toBe("none");
      const x = parseFloat(/translate3d\(([-\d.]+)px/.exec(el.style.transform)?.[1] ?? "NaN");
      expect(x).toBeLessThan(100);
      expect(x).toBeGreaterThan(85);
    } finally {
      repin();
    }
  });

  it("activates a passive participant that joined while probing", () => {
    unpin();
    try {
      const { scheduler, pump } = createFakeScheduler();
      const registry = createTransitionPlayerRegistry(scheduler);
      const active = element();
      const passive = element();

      registry.join("gate-pair", {
        element: active,
        motion: linearMotion({ x: 100 }, { x: 0 }, 1),
        role: "active"
      });
      registry.join("gate-pair", {
        element: passive,
        motion: linearMotion({ x: 0 }, { x: -30 }, 1),
        role: "passive"
      });
      expect(passive.style.animation).toBe("");

      pump(0);
      for (let i = 1; i <= TAKEOVER_PROBE_FRAMES; i++) pump(i * 16);
      expect(active.style.animation).toBe("none");
      expect(passive.style.animation).toBe("none");
    } finally {
      repin();
    }
  });

  it("a pinned 'raf' driver skips the probe and takes over at join", () => {
    // (The surrounding suites run pinned; this asserts the fast path shape.)
    const { scheduler, pendingCount } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("gate-pinned", {
      element: el,
      motion: linearMotion({ x: 100 }, { x: 0 }, 1),
      role: "active"
    });
    // Immediate suppression + from-frame pin + a scheduled step frame.
    expect(el.style.animation).toBe("none");
    expect(el.style.transform).toContain("100px");
    expect(pendingCount()).toBe(1);
  });
});

describe("health-gated takeover: scrub tier and edge branches", () => {
  const unpin = () => localStorage.removeItem("flemo:motion-driver-force");
  const repin = () => localStorage.setItem("flemo:motion-driver-force", "raf");

  it("takes over a scrub track at the motion's current time, not zero", () => {
    unpin();
    try {
      const { scheduler, pump } = createFakeScheduler();
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();
      const { live } = withAnimate(el);

      registry.join("gate-scrub", {
        element: el,
        motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 1),
        role: "active"
      });
      // Validation created and cancelled a throwaway; the element is untouched.
      expect(el.style.animation).toBe("");

      pump(0);
      for (let i = 1; i <= TAKEOVER_PROBE_FRAMES; i++) pump(i * 16);
      // Activation created the LIVE scrub and aligned it with the back-dated
      // clock: the compiled animation has been running since the release, so
      // the scrub starts at the elapsed time, never back at 0.
      expect(el.style.animation).toBe("none");
      expect(live().currentTime).toBeGreaterThan(0);
      expect(live().currentTime).toBeLessThan(200);
    } finally {
      repin();
    }
  });

  it("leaves a track on the compositor when scrub creation fails at activation", () => {
    unpin();
    try {
      const { scheduler, pump } = createFakeScheduler();
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();
      // Validation (call 1) succeeds; the activation-time creation (call 2)
      // throws — WAAPI can reject at any construction.
      let calls = 0;
      el.animate = vi.fn(() => {
        calls += 1;
        if (calls > 1) throw new Error("rejected at activation");
        return fakeAnimation() as unknown as Animation;
      });

      registry.join("gate-scrub-fail", {
        element: el,
        motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 0.1),
        role: "active"
      });
      pump(0);
      for (let i = 1; i <= TAKEOVER_PROBE_FRAMES; i++) pump(i * 16);
      // The failed track was never suppressed: the compiled animation stays in
      // charge and resolves via animationend, and the player loop it rides in
      // completes without crashing.
      expect(el.style.animation).toBe("");
      climbTo(pump, TAKEOVER_PROBE_FRAMES * 16, 300);
    } finally {
      repin();
    }
  });

  it("a probe frame after the last participant detached is a no-op", () => {
    unpin();
    try {
      const { scheduler, pump } = createFakeScheduler();
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();

      const detach = registry.join("gate-detach", {
        element: el,
        motion: linearMotion({ x: 100 }, { x: 0 }, 1),
        role: "active"
      })!;
      pump(0);
      detach();
      // The detach cancelled the pending probe frame; a stray pump must not
      // resurrect the player or touch the element.
      pump(16);
      pump(32);
      expect(el.style.animation).toBe("");
      expect(el.style.transform).toBe("");
    } finally {
      repin();
    }
  });

  it("a zero-duration motion activates straight at its end state", () => {
    unpin();
    try {
      const { scheduler, pump } = createFakeScheduler();
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();
      let completed = 0;

      registry.join("gate-zero", {
        element: el,
        motion: linearMotion({ x: 100 }, { x: 0 }, 0),
        role: "active",
        onComplete: () => {
          completed += 1;
        }
      });
      pump(0);
      for (let i = 1; i <= TAKEOVER_PROBE_FRAMES; i++) pump(i * 16);
      // duration 0 → activation writes the final frame (identity collapses to
      // "none"), and the first step completes the track.
      expect(el.style.transform).toBe("none");
      pump(TAKEOVER_PROBE_FRAMES * 16 + 16);
      expect(completed).toBe(1);
    } finally {
      repin();
    }
  });
});
