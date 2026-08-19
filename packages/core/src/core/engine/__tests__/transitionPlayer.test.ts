import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import animateInline from "@transition/animateInline";
import type { VariantMotion } from "@transition/variantMotion";

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

  it("rejects transform channels authored out of canonical order (non-commutative)", () => {
    // rotate-then-translate is a DIFFERENT path than translate-then-rotate;
    // the numeric tier recomposes canonically, so such motions must fall to
    // the scrub tier where the browser composes the authored list exactly.
    expect(isPlayerDrivable(linearMotion({ rotate: "90deg", x: 100 }, { rotate: 0, x: 0 }))).toBe(
      false
    );
    expect(isPlayerDrivable(linearMotion({ x: 100, rotate: "90deg" }, { x: 0, rotate: 0 }))).toBe(
      true
    );
    // x/y merge into one translate3d — their mutual order is free.
    expect(isPlayerDrivable(linearMotion({ y: 10, x: 10 }, { y: 0, x: 0 }))).toBe(true);
    // Rotates around different axes do not commute either.
    expect(
      isPlayerDrivable(
        linearMotion({ rotateZ: "10deg", rotateX: "10deg" }, { rotateZ: 0, rotateX: 0 })
      )
    ).toBe(false);
    expect(
      isPlayerDrivable(
        linearMotion({ rotateX: "10deg", rotateZ: "10deg" }, { rotateX: 0, rotateZ: 0 })
      )
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
  it("join force-concludes a running settle on its element (navigation authority)", async () => {
    // A tap grazing the swipe edge starts a cancel settle in the same
    // gesture that starts the navigation — the join must end that settle or
    // its WAAPI outranks the player's writes for its whole span
    // (device-captured: backward glide then teleport).
    const { scheduler } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const settleAnim = fakeAnimation();
    withAnimate(el, settleAnim);
    const settle = animateInline(el, { x: 0 }, { duration: 0.3, ease: "linear" });
    expect(settleAnim.canceled).toBe(false);
    registry.join("task-settle-war", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }),
      role: "active"
    });
    // The settle's animation was concluded at join (pinned + cancelled).
    expect(settleAnim.canceled).toBe(true);
    await settle; // and its promise resolves rather than hanging
  });

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

  it("a sustained 30Hz cadence advances the clock at the display's own pace", () => {
    // Every frame arriving at ~33ms IS the display's cadence, not a stall:
    // after a short sustained window the estimator adopts it and the clock
    // stays wall-synced (a 60Hz-capped estimate would advance 16.7ms per
    // 33ms frame and double the flight).
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    let completed = 0;
    registry.join("task-30hz", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }, 0.6),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    let t = 0;
    pump(t);
    for (let i = 0; i < 22 && completed === 0; i++) {
      t += 1000 / 30;
      pump(t);
    }
    // 0.6s of motion in ~0.73s of 30Hz wall time (estimator warmup slack
    // included). The old cap needed ~1.2s of wall time.
    expect(completed).toBe(1);
  });

  it("a stall burst on a fast display keeps the one-frame resume (no cadence poisoning)", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-burst", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }, 0.6),
      role: "active"
    });
    // Healthy 60Hz frames to t=100...
    pump(0);
    for (const t of [16.67, 33.33, 50, 66.67, 83.33, 100]) pump(t);
    // ...then a 40ms block. 40 sits inside the slow-cadence sample window,
    // but the recent gaps are mostly 16.7ms — NOT sustained-slow — so the
    // estimate stays at 60Hz and the clock advances exactly ONE frame.
    pump(140);
    // elapsed = 140 - (40 - 16.67) = 116.67 → x = 400 * (1 - 116.67/600).
    expect(el.style.transform).toBe("translate3d(322px, 0px, 0)");
  });

  it("navigation completes only when the LONGEST track finishes — surviving a stall after the active landed", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const active = element();
    const passive = element();
    let completed = 0;
    registry.join("task-stall", {
      element: active,
      motion: linearMotion({ x: "100%" }, { x: 0 }, 0.3),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    registry.join("task-stall", {
      element: passive,
      motion: linearMotion({ x: 0 }, { x: "-35%" }, 1),
      role: "passive"
    });
    pump(0);
    let t = 0;
    while (t < 350) {
      t += 1000 / 60;
      pump(t);
    }
    // The active track landed; the navigation must NOT have resolved (the
    // passive still has ~650ms of motion).
    expect(completed).toBe(0);
    // A 600ms main-thread stall: the player clock advances ONE frame and
    // re-anchors — the passive's remaining span now ends ~583ms later in
    // wall time. A wall-clock timer would already have fired inside it.
    pump(950);
    expect(completed).toBe(0);
    while (t < 1500) {
      t = Math.max(t, 950) + 1000 / 60;
      pump(t);
    }
    expect(completed).toBe(0); // passive's player clock is still mid-motion
    while (t < 1650 && completed === 0) {
      t += 1000 / 60;
      pump(t);
    }
    expect(completed).toBe(1); // resolves on the player clock, ~583ms late
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

  it("glides sub-device-pixel motion unsnapped, re-snaps when fast (velocity gate)", () => {
    // Pin the GATE: the platform default at desktop densities is always-snap
    // (see defaultAlwaysSnap), and this test exercises the gate itself.
    sessionStorage.setItem("flemo:snap", "gate");
    resetSessionOverrideCachesForTests();
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

  it("the platform default snaps EVERY frame on non-Blink desktop densities, gates at phone densities", () => {
    // dpr 2 (Mac Safari class): slow motion snaps to the device grid.
    {
      const { scheduler, pump } = createFakeScheduler(2);
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();
      registry.join("task-desk", {
        element: el,
        motion: linearMotion({ x: 0 }, { x: -100 }),
        role: "active"
      });
      pump(0);
      pump(16.67); // ~1.67 CSS px in, velocity ~0.83 device px/frame (below the gate)
      const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)!;
      expect(Math.abs(parseFloat(m[1]) * 2) % 1).toBe(0); // on the half-CSS-px device grid
    }
    // dpr 3 (iPhone class): the same slow frame glides fractionally.
    {
      const { scheduler, pump } = createFakeScheduler(3);
      const registry = createTransitionPlayerRegistry(scheduler);
      const el = element();
      registry.join("task-phone", {
        element: el,
        motion: linearMotion({ x: 0 }, { x: -30 }),
        role: "active"
      });
      pump(0);
      pump(16.67); // 0.5 CSS px in → 1.5 device px... keep it slower: next frame
      pump(20); // ~0.6 CSS px → sub-device-px per-frame delta by now
      const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)!;
      // fractional (not on the 1/3 device grid) — the gate's raw glide
      expect(Math.abs(parseFloat(m[1]) * 3) % 1).not.toBe(0);
    }
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
  // Opacity writes land on the display's alpha grid (1/255) — see the
  // quantization note in writeTrack — so a progress read back through an
  // opacity proxy carries up to half a grid step of rounding.
  const alphaGrid = (progress: number) => 1 - Math.round((1 - progress) * 255) / 255;
  const ONE_FRAME_MS = 1000 / 60;

  it("a gap inside the pass-through window advances the full gap (ordinary jitter)", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", { element: el, motion: fadeOut(1), role: "active" });

    pump(0);
    pump(25); // a slightly late frame (≤1.6 nominal) → elapsed IS the gap
    expect(progressOf(el)).toBeCloseTo(alphaGrid(25 / 1000), 5);
  });

  it("a block resumes at exactly ONE frame's step — no velocity discontinuity", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();

    registry.join("task-1", { element: el, motion: fadeOut(1), role: "active" });

    pump(0);
    pump(90); // a 90ms block: the resume step must look like a normal frame
    expect(progressOf(el)).toBeCloseTo(alphaGrid(ONE_FRAME_MS / 1000), 5);
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
    pump(16); // normal frame → one frame of a 100ms motion
    const preProgress = progressOf(el);
    expect(preProgress).toBeCloseTo(alphaGrid(16 / 100), 5);

    pump(400); // 384ms stall: without re-anchor a 100ms motion would be DONE
    const postProgress = progressOf(el);
    // Resumes exactly ONE learned frame (16ms — the median of the gaps so
    // far) past where it stalled, not at the end.
    expect(postProgress).toBeCloseTo(alphaGrid((16 + 16) / 100), 5);
    expect(postProgress).toBeLessThan(0.7);
    expect(completed).toBe(0);

    climbTo(pump, 400, 480); // ordinary frames from here play the tail out in full
    expect(el.style.opacity).toBe("0");
    expect(completed).toBe(1);

    // Player torn down at completion: no late second onComplete.
    pump(999);
    expect(completed).toBe(1);
  });

  it("reports the RAW stall gap to the diagnostic hook even when it re-anchors", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const gaps: number[] = [];
    registry.onFrameGap = (gapMs) => gaps.push(Math.round(gapMs));

    registry.join("task-1", { element: el, motion: fadeOut(1), role: "active" });

    pump(0);
    pump(30);
    pump(400); // re-anchors, but an observer must still see the raw 370ms gap

    expect(gaps).toEqual([30, 370]);
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

    // Past the opening: a FRESH animation takes the remainder — the SAME two
    // endpoints and bezier easing as the scrub, started mid-curve by a NEGATIVE
    // delay so its currentTime begins at the presented pose (no keyframe-bake
    // approximation at the seam). The scrub is cancelled in the same step.
    pump(112);
    expect(animate).toHaveBeenCalledTimes(2);
    const [keyframes, options] = animate.mock.calls[1]! as [
      Record<string, string>[],
      KeyframeAnimationOptions
    ];
    // Exact-curve remainder: the endpoints are identical to the scrub's (both
    // [from, to]); the browser plays the real curve, not a linear-chord bake.
    expect(keyframes.length).toBe(2);
    expect(keyframes).toEqual(animate.mock.calls[0]![0]);
    // Full duration, but started at the PRESENTED pose via a negative delay:
    // the scrub's last-committed currentTime was 96ms (one frame behind the
    // 112ms clock), so delay = -96 lands currentTime there at birth.
    expect(options.duration).toBe(1000);
    expect(options.delay).toBe(-96);
    expect(options.easing).toBe("linear"); // the motion's own (linear) easing
    expect(options.fill).toBe("both");
    expect(scrub.canceled).toBe(true);
    expect(el.style.animation).toBe("none"); // compiled stays suppressed for the whole flight
    // The loop stops — the browser presents from here, so no more frames.
    expect(pendingCount()).toBe(0);
    expect(completed).toBe(0);

    // With the compiled animation suppressed throughout, no animationend can
    // fire — the player IS the single live resolver, so the finish event
    // completes the flight here (and only once).
    remainder.onfinish?.();
    expect(completed).toBe(1);
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

// The remainder bake and the handoff's decline paths: what the baked
// keyframes carry per channel class, and the frames where tryHandOff decides
// the browser has nothing (or nothing visible) left to take.
describe("anchored-opening handoff — remainder bake and decline paths", () => {
  beforeEach(() => {
    sessionStorage.setItem("flemo:handoff", "on");
    resetSessionOverrideCachesForTests();
  });
  afterEach(() => {
    sessionStorage.removeItem("flemo:handoff");
    resetSessionOverrideCachesForTests();
    vi.restoreAllMocks();
  });

  const remainderAnimation = () => ({
    ...fakeAnimation(),
    onfinish: null as (() => void) | null
  });

  it("bakes every transform channel, string templates, and constants into the remainder", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const remainder = remainderAnimation();
    const animate = vi.fn().mockReturnValueOnce(scrub).mockReturnValueOnce(remainder);
    el.animate = animate as unknown as typeof el.animate;

    registry.join("task-1", {
      element: el,
      // Every serializable channel class at once: y (percent-based), z,
      // the three scales, the three rotates, a string template (filter),
      // and a constant carried across the flight (boxShadow). filter is not
      // a perceptual-cut channel, so the cut self-vetoes and cannot land
      // before the handoff frame.
      motion: linearMotion(
        {
          y: "100%",
          z: 8,
          scale: 0.5,
          scaleX: 0.25,
          scaleY: 0.5,
          rotate: 45,
          rotateX: 10,
          rotateY: 20,
          filter: "blur(8px)",
          boxShadow: "0 0 12px rgba(0, 0, 0, 0.3)"
        },
        {
          y: 0,
          z: 0,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
          rotate: 0,
          rotateX: 0,
          rotateY: 0,
          filter: "blur(0px)",
          boxShadow: "0 0 12px rgba(0, 0, 0, 0.3)"
        },
        1
      ),
      role: "active"
    });
    pump(0);
    climbTo(pump, 0, 112); // frame cadence to just past HANDOFF_MS

    expect(animate).toHaveBeenCalledTimes(2);
    const [keyframes, options] = animate.mock.calls[1]! as [
      Record<string, string>[],
      KeyframeAnimationOptions
    ];
    // Exact-curve remainder: the SAME two endpoints as the scrub (the browser
    // plays the real curve via a negative delay, not a per-channel bake), so
    // every authored channel — transforms, string templates, and held
    // constants alike — rides through unchanged from the scrub's own frames.
    expect(keyframes.length).toBe(2);
    expect(keyframes).toEqual(animate.mock.calls[0]![0]);
    // Full duration, started mid-curve at the presented pose (climb last set
    // the scrub to 96ms, one frame behind the 112ms clock) via a negative delay.
    expect(options.duration).toBe(1000);
    expect(options.delay).toBe(-96);
    expect(options.fill).toBe("both");
  });

  it("a transform-less motion bakes opacity-only keyframes (no transform key)", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const remainder = remainderAnimation();
    const animate = vi.fn().mockReturnValueOnce(scrub).mockReturnValueOnce(remainder);
    el.animate = animate as unknown as typeof el.animate;

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ opacity: 0 }, { opacity: 1 }, 1),
      role: "active"
    });
    pump(0);
    climbTo(pump, 0, 112);

    expect(animate).toHaveBeenCalledTimes(2);
    const keyframes = animate.mock.calls[1]![0] as Record<string, string>[];
    // Transform-less motion → opacity-only endpoints, identical to the scrub's
    // frames (negative-delay exact curve, no per-channel bake), no transform key.
    expect(keyframes.length).toBe(2);
    expect(keyframes).toEqual(animate.mock.calls[0]![0]);
    expect(keyframes[0]!.transform).toBeUndefined();
    expect(keyframes[0]!).toEqual({ opacity: "0" });
    expect(keyframes[1]!).toEqual({ opacity: "1" });
  });

  it("a delay-only motion (zero duration) declines the handoff and stays scrubbed", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const animate = withAnimate(el, scrub);
    let completed = 0;

    registry.join("task-1", {
      element: el,
      // The handoff frame lands inside the 500ms delay: activeElapsed is 0
      // and the duration is 0, so the remainder would be an empty animation
      // — nothing for the browser to take. The scrub carries the flight.
      motion: { from: { x: 400 }, to: { x: 0 }, duration: 0, delay: 0.5, ease: "linear" },
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    pump(0);
    climbTo(pump, 0, 112); // past HANDOFF_MS, still inside the delay
    expect(animate).toHaveBeenCalledTimes(1); // no remainder animation
    expect(scrub.canceled).toBe(false);
    expect(scrub.currentTime).toBe(112);

    climbTo(pump, 112, 500); // the scrub clock reaches delay + duration
    expect(completed).toBe(1);
  });

  it("declines the handoff when the remaining eased span is imperceptible", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const animate = withAnimate(el, scrub);
    const vetoEl = element();
    withAnimate(vetoEl, fakeAnimation());
    let completed = 0;

    registry.join("task-1", {
      element: el,
      // ease [0,1,0,1] on a 120ms flight: at the 112ms handoff frame the
      // eased value sits within ~1e-4 of the end — a remainder animation
      // would present nothing. Letting the scrub finish avoids paying a
      // fresh accelerated animation for an invisible tail.
      motion: {
        from: { x: 400 },
        to: { x: 0 },
        duration: 0.12,
        delay: 0,
        ease: [0, 1, 0, 1] as VariantMotion["ease"]
      },
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    // The steep curve's perceptual cut would complete the track BEFORE the
    // handoff frame; an unanalyzable participant vetoes the navigation's cut
    // so the handoff decision itself is what this test reaches.
    registry.join("task-1", {
      element: vetoEl,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 1),
      role: "passive"
    });

    pump(0);
    climbTo(pump, 0, 112); // the handoff frame: declined, scrub keeps driving
    expect(animate).toHaveBeenCalledTimes(1);
    expect(scrub.canceled).toBe(false);
    expect(scrub.currentTime).toBe(112);

    climbTo(pump, 112, 1000); // active ends at 120 on the scrub; passive at 1000
    expect(completed).toBe(1);
  });

  it("a handed-off track idles in the loop while a sibling still needs frames", () => {
    const { scheduler, pump, pendingCount } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    const scrub = fakeAnimation();
    const remainder = remainderAnimation();
    el.animate = vi
      .fn()
      .mockReturnValueOnce(scrub)
      .mockReturnValueOnce(remainder) as unknown as typeof el.animate;
    const passiveEl = element();
    const passiveScrub = fakeAnimation();
    withAnimate(passiveEl, passiveScrub);
    let completed = 0;

    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: "100%" }, { x: 0 }, 0.5),
      role: "active",
      onComplete: () => {
        completed += 1;
      }
    });
    registry.join("task-1", {
      element: passiveEl,
      // Non-numeric: scrubbed for its whole flight, so the loop must keep
      // pumping frames after the active's handoff.
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 1),
      role: "passive"
    });

    pump(0);
    climbTo(pump, 0, 112); // the active hands off here...
    expect(remainder.canceled).toBe(false);
    // ...but the passive still needs frames, so the loop stays alive — the
    // handed-off track just idles in it (the browser presents its motion).
    expect(pendingCount()).toBe(1);

    climbTo(pump, 112, 1000); // the passive finishes on the player clock
    // Every remaining track is now the browser's: the loop stops, but the
    // navigation stays open until the remainder's finish event.
    expect(pendingCount()).toBe(0);
    expect(completed).toBe(0);
    remainder.onfinish?.();
    expect(completed).toBe(1);
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

// The last device pixel belongs to rest: once a translate channel's
// remainder enters the device-pixel band (the same imperceptibility band the
// perceptual cut and early landing use), the player writes the EXACT end
// pose. Without it a decelerating curve crawls sub-pixel for its last
// ~100ms — snapped displays park one device pixel short and tick the final
// pixel at the COMPLETED flip, a visibly late landing.
describe("last-pixel landing", () => {
  it("writes the exact end pose once the remainder enters the device-pixel band", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    withAnimate(el, fakeAnimation());
    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: 400 }, { x: 0 }, 1),
      role: "active"
    });
    pump(0);
    climbTo(pump, 0, 990);
    // 10ms out on a linear 400px/s curve: 4px remain — outside the band.
    expect(el.style.transform).toBe("translate3d(4px, 0px, 0)");
    pump(999.5);
    // 0.2px remain: inside the band — the write IS the rest pose.
    expect(el.style.transform).toBe("none");
  });

  it("the governor closes a parallax return's slow tail at one device pixel per frame", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    withAnimate(el, fakeAnimation());
    registry.join("task-1", {
      element: el,
      // The pop-returning parallax: less travel on the same curve, so its
      // absolute tail is even slower — the case that read as a whole screen
      // parked short of its landing, then jumping.
      motion: {
        from: { x: -420 },
        to: { x: 0 },
        duration: 0.7,
        delay: 0,
        ease: [0.32, 0.72, 0, 1]
      } as VariantMotion,
      role: "active"
    });
    pump(0);
    climbTo(pump, 0, 520);
    const at = () => {
      const m = /translate3d\((-?\d*\.?\d+)px/.exec(el.style.transform);
      return m ? parseFloat(m[1]!) : el.style.transform === "none" ? 0 : NaN;
    };
    // Walk frame by frame through the tail: once the governor engages, every
    // frame moves EXACTLY one device pixel until rest — no park, no jump.
    let previous = at();
    let engagedSteps = 0;
    for (let t = 536; t <= 700 && previous !== 0; t += 16) {
      pump(t);
      const current = at();
      const step = Math.abs(current - previous);
      expect(step).toBeLessThanOrEqual(1 + 1e-6);
      if (Math.abs(step - 1) < 1e-6) engagedSteps += 1;
      previous = current;
    }
    expect(previous).toBe(0); // landed before the authored end
    expect(engagedSteps).toBeGreaterThan(1); // via the governor's 1px cadence
  });

  it("a flat decelerating tail lands as soon as it can no longer step a full pixel", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    withAnimate(el, fakeAnimation());
    registry.join("task-1", {
      element: el,
      // The cupertino-class ease: its tail crawls the last 2-3px for over
      // 100ms — the span that presented as a parked sheet with the covered
      // screen's dim sliver exposed at its edge.
      motion: {
        from: { x: 1400 },
        to: { x: 0 },
        duration: 0.7,
        delay: 0,
        ease: [0.32, 0.72, 0, 1]
      } as VariantMotion,
      role: "active"
    });
    // An unanalyzable participant vetoes the perceptual cut, so the governor
    // itself is what closes the tail (mirroring the real choreography, where
    // decorator/part vetoes routinely disable the cut).
    const vetoEl = element();
    withAnimate(vetoEl, fakeAnimation());
    registry.join("task-1", {
      element: vetoEl,
      motion: linearMotion({ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0)" }, 1),
      role: "passive"
    });
    pump(0);
    climbTo(pump, 0, 560);
    // Walk the tail at the display cadence and log the landing frame: the
    // governor engages once the per-frame travel drops below a device pixel
    // and closes at 1px/frame — at rest strictly before the authored end.
    let landedAt: number | null = null;
    for (let t = 576; t <= 696 && landedAt === null; t += 16) {
      pump(t);
      if (el.style.transform === "none") landedAt = t;
    }
    expect(landedAt).not.toBeNull();
    expect(landedAt!).toBeLessThan(700);
  });

  it("the perceptual cut presents the rest pose instead of parking a hairline", () => {
    // The real-Chrome trace this encodes (60Hz cadence, 2560-device-px push):
    // the authored tail stepped 2,2,1 device px without ever latching the
    // governor, the cut then completed the track WITHOUT a write, and the
    // presented pose parked one device pixel short until the COMPLETED
    // flip's teardown ~120ms later — the "gap filled late" hairline at the
    // sheet's leading edge. The cut must land the rest pose itself.
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetWidth", { value: 1280, configurable: true });
    Object.defineProperty(el, "offsetHeight", { value: 800, configurable: true });
    // The perceptual box reads clientWidth/Height — without them the cut
    // computes null and this test silently stops exercising the cut branch.
    Object.defineProperty(el, "clientWidth", { value: 1280, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 800, configurable: true });
    Object.defineProperty(el, "isConnected", { value: true, configurable: true });
    document.body.appendChild(el);
    withAnimate(el, fakeAnimation());
    registry.join("task-cut-landing", {
      element: el,
      motion: {
        from: { x: "100%" },
        to: { x: 0 },
        duration: 0.7,
        delay: 0,
        ease: [0.32, 0.72, 0, 1]
      } as VariantMotion,
      role: "active"
    });
    pump(0);
    climbTo(pump, 0, 560);
    let landedAt: number | null = null;
    for (let t = 576; t <= 900 && landedAt === null; t += 16) {
      pump(t);
      if (el.style.transform === "none") landedAt = t;
    }
    expect(landedAt).not.toBeNull();
    // Landed by the player itself, at most a couple frames past the authored
    // end — never parked for an external teardown.
    expect(landedAt!).toBeLessThanOrEqual(752);
    el.remove();
  });

  it("a non-zero destination lands on its exact authored value", () => {
    const { scheduler, pump } = createFakeScheduler();
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    withAnimate(el, fakeAnimation());
    registry.join("task-1", {
      element: el,
      motion: linearMotion({ x: 0 }, { x: -120 }, 1),
      role: "active"
    });
    pump(0);
    climbTo(pump, 0, 999.6);
    expect(el.style.transform).toBe("translate3d(-120px, 0px, 0)");
  });
});

// STEADY-60 DESKTOP pure-glide profile (see pureGlideProfile): a desktop
// Blink session whose in-flight cadence verified steady-60 writes RAW
// fractional values everywhere — no gate snapping, no landing-governor
// staircase. Device-judged on the 4K@60Hz 2x class: every integer-stepping
// variant presented as deterministic pop-parallax ratcheting under the
// platform's uneven present pacing; the bilinear glide masks it.
describe("steady-60 desktop pure-glide profile", () => {
  const NAV = navigator as { userAgentData?: unknown };
  const slide = () => linearMotion({ x: 0 }, { x: -100 }, 1);
  let originalDpr: number;
  beforeEach(async () => {
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    const { reportInFlightCadence } = await import("@core/engine/steadySixtyCadence");
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
  });
  afterEach(async () => {
    const { resetSteadySixtyForTests } = await import("@core/engine/steadySixtyCadence");
    resetSteadySixtyForTests();
    delete NAV.userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
    sessionStorage.removeItem("flemo:snap");
    resetSessionOverrideCachesForTests();
  });

  it("writes raw fractional values with no gate snapping", () => {
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-glide", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(17); // -1.7px would snap to -1.5 under always/gate; glide keeps it raw
    expect(el.style.transform).toBe("translate3d(-1.7px, 0px, 0)");
  });

  it("the landing governor stands down: the tail approaches fractionally", () => {
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    // 10px of travel over 1s: the whole flight sits inside the governor's
    // 12-device-px engagement range at sub-device-pixel velocity.
    registry.join("task-tail", {
      element: el,
      motion: linearMotion({ x: -10 }, { x: 0 }, 1),
      role: "active"
    });
    pump(0);
    climbTo(pump, 0, 500); // halfway: -5px, velocity 0.1 CSS px/frame — the governor would latch
    const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)!;
    // Raw curve value (-5), not a 1-device-px staircase step from the start.
    expect(parseFloat(m[1])).toBeCloseTo(-5, 0);
    pump(517);
    const m2 = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)!;
    // The next frame advances by the curve's own fraction (~0.17px), not by
    // the governor's fixed half-CSS-px step.
    expect(Math.abs(parseFloat(m2[1]) - parseFloat(m[1]))).toBeLessThan(0.3);
  });

  it("a fast full-travel mover keeps the gate's snapping (per-track split)", () => {
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    // 800 CSS px of travel = 1600 device px: the push-slide class.
    registry.join("task-fast", {
      element: el,
      motion: linearMotion({ x: 0 }, { x: -800 }, 1),
      role: "active"
    });
    pump(0);
    pump(17); // raw -13.6px; the gate snaps fast motion to the device grid
    const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)!;
    expect((Math.abs(parseFloat(m[1])) * 2) % 1).toBe(0);
  });

  it("an explicit session override still wins over the profile", () => {
    sessionStorage.setItem("flemo:snap", "always");
    resetSessionOverrideCachesForTests();
    const { scheduler, pump } = createFakeScheduler(2);
    const registry = createTransitionPlayerRegistry(scheduler);
    const el = element();
    registry.join("task-ovr", { element: el, motion: slide(), role: "active" });
    pump(0);
    pump(17);
    expect(el.style.transform).toBe("translate3d(-1.5px, 0px, 0)");
  });
});
