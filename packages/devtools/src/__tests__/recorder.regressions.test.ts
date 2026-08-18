import { afterEach, describe, expect, it, vi } from "vitest";

import { attachFlightRecorder } from "../recorder";

import type { FlightRecorderHandle } from "../types";

// The regression net: one test per defect class the 2026-08 campaign actually
// shipped a fix for. These are the reasons the recorder exists — if one of
// them stops firing, a real, user-visible bug can come back silently.
//
// The unifying property: every defect here is INVISIBLE to frame timing. rAF
// ticked at a clean 16.7ms through all of them.

const frame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
const frames = async (count: number) => {
  for (let index = 0; index < count; index += 1) await frame();
};
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let handle: FlightRecorderHandle | null = null;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
});

const mountScreen = () => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", "IDLE");
  screen.setAttribute("data-flemo-active", "false");
  document.body.appendChild(screen);
  return screen;
};

/** A compiled flight: the engine's own CSSAnimation drives the pose. */
const stubCompiledAnimation = (screen: HTMLElement, clock: { time: number; state: string }) => {
  (screen as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [
    {
      animationName: "flemo-screen-cupertino-enter",
      get playState() {
        return clock.state;
      },
      get currentTime() {
        return clock.time;
      }
    }
  ];
};

const openFlight = async (screen: HTMLElement, hold = "park") => {
  screen.setAttribute("data-flemo-anim-hold", hold);
  screen.setAttribute("data-flemo-status", "PUSHING");
  screen.setAttribute("data-flemo-active", "true");
  await settle();
};

const release = async (screen: HTMLElement) => {
  screen.setAttribute("data-flemo-anim-hold", "false");
  await settle();
};

const land = async (screen: HTMLElement) => {
  screen.setAttribute("data-flemo-status", "COMPLETED");
  await settle();
  await frames(4);
};

describe("regression net: motion that stops while the frames keep coming", () => {
  it("flags a hold re-asserted over a running flight (the release race)", async () => {
    const screen = mountScreen();
    const clock = { time: 0, state: "running" };
    stubCompiledAnimation(screen, clock);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await frames(2);
    // An interleaved commit writes the stale paused hold attribute back over
    // the running flight — the 2026-08-18 race that froze motion ~250ms.
    screen.setAttribute("data-flemo-anim-hold", "park");
    await settle();
    await frames(2);
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.motion.holdReassertedAtMs).not.toBeNull();
    expect(flight.anomalies.some((entry) => entry.includes("hold re-asserted"))).toBe(true);
  });

  it("flags a stalled pose even while every frame arrives on time", async () => {
    const screen = mountScreen();
    const clock = { time: 0, state: "running" };
    stubCompiledAnimation(screen, clock);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    // The clock never advances: frames keep arriving, the screen does not move.
    // Real time passes between rAF callbacks, so the stall run accumulates.
    await frames(8);
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.motion.stalledFrames).toBeGreaterThan(0);
    expect(flight.motion.longestStallMs).toBeGreaterThan(0);
  });

  it("counts an advancing clock as motion, and reports no stall", async () => {
    const screen = mountScreen();
    const clock = { time: 0, state: "running" };
    stubCompiledAnimation(screen, clock);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    for (let i = 0; i < 6; i += 1) {
      clock.time += 16.7;
      await frame();
    }
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.motion.sampledFrames).toBeGreaterThan(0);
    expect(flight.motion.stalledFrames).toBe(0);
    expect(flight.anomalies.some((entry) => entry.includes("motion stalled"))).toBe(false);
  });

  it("flags a compiled animation that reports playState=paused after release", async () => {
    const screen = mountScreen();
    const clock = { time: 0, state: "running" };
    stubCompiledAnimation(screen, clock);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    clock.state = "paused";
    await frames(3);
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.motion.pausedAfterRelease).toBe(true);
    expect(flight.anomalies.some((entry) => entry.includes("playState=paused"))).toBe(true);
  });
});

describe("regression net: progress accounting details", () => {
  it("keeps the LONGEST stall, not the most recent one", async () => {
    const screen = mountScreen();
    const clock = { time: 0, state: "running" };
    stubCompiledAnimation(screen, clock);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    // A long freeze…
    await frames(5);
    const afterLongStall = handle.report().flights[0].motion.longestStallMs;
    // …then one moving frame, then a single frozen frame: the short run must
    // not overwrite the long one an agent is trying to read.
    clock.time += 16.7;
    await frame();
    await frames(1);
    await land(screen);

    const flight = handle.report().flights[0];
    expect(afterLongStall).toBeGreaterThan(0);
    expect(flight.motion.longestStallMs).toBe(afterLongStall);
  });

  it("reads the player's inline pose on a screen that also carries a compiled clock", async () => {
    const screen = mountScreen();
    const clock = { time: 0, state: "running" };
    stubCompiledAnimation(screen, clock);
    // The mixed signature: a flemo CSSAnimation is attached AND the player
    // has staked the inline style, which is how a handoff presents.
    screen.style.animation = "none";
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    for (let i = 0; i < 4; i += 1) {
      screen.style.transform = `translateX(${i * 12}px)`;
      await frame();
    }
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.driver).toBe("mixed");
    expect(flight.motion.stalledFrames).toBe(0);
  });
});

describe("regression net: the driver must still be classified", () => {
  it("classifies a flight whose animation was paused when first sampled", async () => {
    const screen = mountScreen();
    // The engine poses the screen BEFORE releasing it, so the very first
    // sample of a normal compiled flight catches a paused animation. A
    // sampler that caches that handle and stops looking would then report
    // driver "unknown" for an ordinary POP — browser-observed, which is why
    // this test exists.
    const clock = { time: 0, state: "paused" };
    stubCompiledAnimation(screen, clock);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await frames(2);
    clock.state = "running";
    await release(screen);
    for (let i = 0; i < 4; i += 1) {
      clock.time += 16.7;
      await frame();
    }
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.driver).toBe("compiled");
    expect(flight.anomalies.some((entry) => entry.includes("could not be classified"))).toBe(false);
  });
});

describe("regression net: holds that outlive their flight", () => {
  it("flags image and arrival hold markers still on the page at rest", async () => {
    const screen = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    // Orphans: the hold released its owner but the markers stayed — the class
    // that left ~130 avatars permanently blank.
    const orphanImg = document.createElement("img");
    orphanImg.setAttribute("data-flemo-img-hold", "");
    const orphanArrival = document.createElement("div");
    orphanArrival.setAttribute("data-flemo-held-arrival", "");
    screen.append(orphanImg, orphanArrival);
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.landing.orphanedHolds).toHaveLength(2);
    expect(flight.anomalies.some((entry) => entry.includes("hold markers left"))).toBe(true);
  });

  it("stays quiet when the holds released cleanly", async () => {
    const screen = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.landing.orphanedHolds).toEqual([]);
  });
});

describe("regression net: images decoding onto the moving layer", () => {
  const addImage = (screen: HTMLElement, complete: boolean) => {
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { value: complete, configurable: true });
    screen.appendChild(img);
    return img;
  };

  it("flags an unheld image that finished loading mid-flight", async () => {
    const screen = mountScreen();
    const img = addImage(screen, false);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await frames(2);
    // The avatar resolves ON the sliding layer, with no hold parking it:
    // glass-measured at one skipped present per decode.
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.images.loadingAtStart).toBe(1);
    expect(flight.images.completedDuringFlight).toBe(1);
    expect(flight.images.heldDuringFlight).toBe(0);
    expect(flight.anomalies.some((entry) => entry.includes("without a hold"))).toBe(true);
  });

  it("stays quiet when the engine held the loading image", async () => {
    const screen = mountScreen();
    const img = addImage(screen, false);
    img.setAttribute("data-flemo-img-hold", "");
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await frames(2);
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    img.removeAttribute("data-flemo-img-hold");
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.images.heldDuringFlight).toBe(1);
    expect(flight.anomalies.some((entry) => entry.includes("without a hold"))).toBe(false);
  });
});

describe("regression net: a report taken mid-flight still carries the new sections", () => {
  it("reports motion and image state for a flight that has not landed yet", async () => {
    const screen = mountScreen();
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { value: false, configurable: true });
    screen.appendChild(img);
    const clock = { time: 0, state: "running" };
    stubCompiledAnimation(screen, clock);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await frames(2);
    Object.defineProperty(img, "complete", { value: true, configurable: true });

    // Still transitional: the provisional record must carry the same shape as
    // a closed one, or an agent reading a report mid-navigation sees nothing.
    const flight = handle.report().flights[0];
    expect(flight.id).toContain("(in flight)");
    expect(flight.images.loadingAtStart).toBe(1);
    expect(flight.images.completedDuringFlight).toBe(1);
    expect(flight.motion.sampledFrames).toBeGreaterThan(0);
    expect(flight.landing.orphanedHolds).toEqual([]);
  });
});

// The review round on PR #264: four ways the first cut of these detectors
// could have lied. Each of these fails without its fix.
describe("regression net: image accounting is per image, not per count", () => {
  const addImage = (parent: HTMLElement, complete: boolean, held = false) => {
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { value: complete, configurable: true });
    if (held) img.setAttribute("data-flemo-img-hold", "");
    parent.appendChild(img);
    return img;
  };

  it("does not let a held-but-loading image cancel out an unheld completed one", async () => {
    const screen = mountScreen();
    // A stays held and unfinished; B finishes with no hold. Subtracting the
    // two counts gives 1 - 1 = 0 and reports nothing — the bug.
    addImage(screen, false, true);
    const b = addImage(screen, false);
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await frames(2);
    Object.defineProperty(b, "complete", { value: true, configurable: true });
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.images.completedUnheld).toBe(1);
    expect(flight.anomalies.some((entry) => entry.includes("without a hold"))).toBe(true);
  });

  it("tracks an image inserted mid-flight by a data commit", async () => {
    const screen = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await frames(1);
    // The commit the arrival hold exists for: content lands mid-navigation.
    const late = addImage(screen, false);
    await settle();
    await frames(1);
    Object.defineProperty(late, "complete", { value: true, configurable: true });
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.images.addedDuringFlight).toBe(1);
    expect(flight.images.completedUnheld).toBe(1);
  });

  it("tracks images inside a screen that joins after the flight opened", async () => {
    const first = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(first);
    await release(first);
    await frames(1);

    // React prepares an entering screen off-DOM and appends the complete
    // subtree in one commit. The childList callback sees this node before
    // evaluate() has unioned it into the flight participants.
    const joined = document.createElement("div");
    joined.setAttribute("data-flemo-screen", "");
    joined.setAttribute("data-flemo-status", "PUSHING");
    joined.setAttribute("data-flemo-active", "false");
    const late = addImage(joined, false);
    document.body.appendChild(joined);
    await settle();
    await frames(1);

    Object.defineProperty(late, "complete", { value: true, configurable: true });
    first.setAttribute("data-flemo-status", "COMPLETED");
    joined.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(4);

    const flight = handle.report().flights[0];
    expect(flight.participants.screens).toBe(2);
    expect(flight.images.addedDuringFlight).toBe(1);
    expect(flight.images.completedUnheld).toBe(1);
  });

  it("counts a mid-flight arrival the engine parked as held", async () => {
    const screen = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    await frames(1);
    const late = addImage(screen, false);
    await settle();
    await frames(1);
    late.setAttribute("data-flemo-img-hold", "");
    Object.defineProperty(late, "complete", { value: true, configurable: true });
    await land(screen);

    const flight = handle.report().flights[0];
    expect(flight.images.heldDuringFlight).toBe(1);
    expect(flight.images.completedUnheld).toBe(0);
    expect(flight.anomalies.some((entry) => entry.includes("without a hold"))).toBe(false);
  });
});

describe("regression net: mid-flight tracking stays cheap and total", () => {
  it("ignores non-element additions", async () => {
    const screen = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    screen.appendChild(document.createTextNode("a data commit's text"));
    await settle();
    await frames(1);
    await land(screen);

    expect(handle.report().flights[0].images.addedDuringFlight).toBe(0);
  });

  it("caps how many images one flight will track", async () => {
    const screen = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    // A list commit can append hundreds at once; the recorder must not turn
    // into the cost it is measuring.
    const batch = document.createElement("div");
    for (let i = 0; i < 260; i += 1) {
      const img = document.createElement("img");
      Object.defineProperty(img, "complete", { value: false, configurable: true });
      batch.appendChild(img);
    }
    screen.appendChild(batch);
    await settle();
    await frames(1);
    await land(screen);

    expect(handle.report().flights[0].images.addedDuringFlight).toBe(200);
  });
});

describe("regression net: an orphan must belong to the flight it is reported on", () => {
  it("does not blame a flight for the next one's working holds", async () => {
    const screen = mountScreen();
    handle = attachFlightRecorder();
    await settle();

    await openFlight(screen);
    await release(screen);
    // The first flight lands, and a back-to-back navigation opens before the
    // +2rAF audit runs — with legitimate hold markers of its own.
    screen.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    const holder = document.createElement("img");
    holder.setAttribute("data-flemo-img-hold", "");
    screen.appendChild(holder);
    screen.setAttribute("data-flemo-status", "POPPING");
    await settle();
    await frames(4);

    const first = handle.report().flights[0];
    expect(first.landing.orphanedHolds).toEqual([]);
  });
});

describe("regression net: the judging protocol travels with the report", () => {
  it("states the DevTools-closed, no-capture, real-input preconditions", () => {
    handle = attachFlightRecorder();
    const report = handle.report();

    expect(report.judgingProtocol.length).toBeGreaterThanOrEqual(4);
    const joined = report.judgingProtocol.join(" ");
    expect(joined).toContain("DevTools");
    expect(joined).toContain("capture");
    expect(joined).toContain("pointerdown");
  });
});
