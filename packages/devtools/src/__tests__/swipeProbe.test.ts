import { afterEach, describe, expect, it, vi } from "vitest";

import { attachSwipeProbe, SWIPE_PROBE_MS } from "../swipeProbe";

// A drag is not a flight, so nothing else in this package opens a window for
// one. What this pins is the question a swipe report always turns out to be
// about: did the release MOVE the screens, and did it slow down as it arrived.

/** A driven clock and frame source, so a settle can be played out exactly. */
const rig = () => {
  let clock = 0;
  const queue: (() => void)[] = [];
  return {
    now: () => clock,
    schedule: (run: () => void) => queue.push(run),
    /** Advance one frame, letting the probe read whatever the test has set. */
    frame(ms = 16) {
      clock += ms;
      queue.splice(0, queue.length).forEach((run) => run());
    },
    /** Run the whole watch window out. */
    settle() {
      for (let index = 0; index < Math.ceil(SWIPE_PROBE_MS / 16) + 2; index += 1) this.frame();
    }
  };
};

const screen = (x: number) => {
  const element = document.createElement("div");
  element.setAttribute("data-flemo-screen", "s1");
  element.setAttribute("data-flemo-status", "COMPLETED");
  element.setAttribute("data-flemo-active", "true");
  element.style.transform = `matrix(1, 0, 0, 1, ${x}, 0)`;
  Object.defineProperty(element, "getAnimations", { value: () => [], configurable: true });
  document.body.appendChild(element);
  return element;
};

const moveTo = (element: HTMLElement, x: number) => {
  element.style.transform = `matrix(1, 0, 0, 1, ${x}, 0)`;
};

const release = () => document.dispatchEvent(new Event("pointerup"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the swipe probe", () => {
  it("says nothing about a release that had nothing to land", () => {
    screen(0);
    const onRelease = vi.fn();
    const clock = rig();
    const handle = attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.settle();

    expect(onRelease).not.toHaveBeenCalled();
    handle.detach();
  });

  it("calls a landing that never slows down un-eased", () => {
    // The defect it was built for: a release handed back as a constant rate.
    // Every frame covers the same ground and then it stops.
    const element = screen(120);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    for (let x = 120; x >= 0; x -= 8) {
      moveTo(element, x);
      clock.frame();
    }
    clock.settle();

    const audit = onRelease.mock.calls[0]![0];
    expect(audit.travelAtReleasePx).toBe(120);
    expect(audit.openingStepPx).toBeCloseTo(audit.closingStepPx, 1);
    expect(audit.eased).toBe(false);
    expect(audit.teleported).toBe(false);
  });

  it("calls a landing that feathers in eased", () => {
    const element = screen(120);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    // Halving what is left each frame: the shape a decelerating landing has.
    let left = 120;
    while (left > 0.2) {
      left = left / 1.6;
      moveTo(element, left);
      clock.frame();
    }
    clock.settle();

    const audit = onRelease.mock.calls[0]![0];
    expect(audit.closingStepPx).toBeLessThan(audit.openingStepPx * 0.5);
    expect(audit.eased).toBe(true);
  });

  it("calls a release that crossed its whole travel in one frame a teleport", () => {
    const element = screen(120);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.frame();
    moveTo(element, 0);
    clock.settle();

    const audit = onRelease.mock.calls[0]![0];
    expect(audit.biggestStepPx).toBe(120);
    expect(audit.teleported).toBe(true);
  });

  it("records what was driving the screens, or that nothing was", () => {
    const element = screen(90);
    Object.defineProperty(element, "getAnimations", {
      value: () => [
        { animationName: undefined, playState: "running", currentTime: 210, playbackRate: -0.5 },
        {
          animationName: "flemo-screen-cupertino-POPPING-true",
          playState: "running",
          currentTime: 40,
          playbackRate: 1
        }
      ],
      configurable: true
    });
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.settle();

    const audit = onRelease.mock.calls[0]![0];
    expect(audit.samples[0]!.animations).toEqual([
      "waapi|running|ct=210|rate=-0.5",
      "flemo-screen-cupertino-POPPING-true|running|ct=40|rate=1"
    ]);
  });

  it("reads the release off the screen that travels furthest", () => {
    // cupertino moves the covered screen a third as far. Averaging the two
    // would flatten every ratio this reports.
    // The covered screen is first in the document, as it is in a real stack,
    // and the dragged one behind it is the one the release is about.
    const covered = screen(-40);
    const dragged = screen(120);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    let left = 120;
    while (left > 0.2) {
      left = left / 1.6;
      moveTo(dragged, left);
      moveTo(covered, -left / 3);
      clock.frame();
    }
    clock.settle();

    expect(onRelease.mock.calls[0]![0].eased).toBe(true);
  });

  it("uses the browser's own clock and frames when neither is given", async () => {
    // The default path, driven for real. It costs the length of one watch
    // window, which is the honest price of not marking it unreachable.
    const element = screen(60);
    const onRelease = vi.fn();
    attachSwipeProbe({ onRelease });

    release();
    for (let index = 0; index < 6; index += 1) {
      moveTo(element, 60 - index * 10);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    await new Promise((resolve) => setTimeout(resolve, SWIPE_PROBE_MS + 200));

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onRelease.mock.calls[0]![0].samples.length).toBeGreaterThan(0);
  }, 10_000);

  it("says nothing when there are no screens to watch", () => {
    // A release outside a flemo Router, which is most releases on most pages.
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.settle();

    expect(onRelease).not.toHaveBeenCalled();
  });

  it("skips a screen the host gives no animations to read", () => {
    // Not every element answers getAnimations, and a probe must not be the
    // thing that throws inside a release.
    const bare = document.createElement("div");
    bare.setAttribute("data-flemo-screen", "bare");
    bare.style.transform = "matrix(1, 0, 0, 1, 70, 0)";
    document.body.appendChild(bare);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.settle();

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onRelease.mock.calls[0]![0].samples[0]!.animations).toEqual([]);
  });

  it("reads a screen whose transform carries no translation as home", () => {
    screen(120);
    const still = document.createElement("div");
    still.setAttribute("data-flemo-screen", "still");
    still.style.transform = "none";
    document.body.appendChild(still);
    Object.defineProperty(still, "getAnimations", { value: () => [], configurable: true });
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.settle();

    expect(onRelease.mock.calls[0]![0].samples[0]!.x).toContain(0);
  });

  it("reads an animation with no resolved time as zero", () => {
    const element = screen(80);
    Object.defineProperty(element, "getAnimations", {
      value: () => [
        { animationName: "flemo-x", playState: "paused", currentTime: null, playbackRate: 1 }
      ],
      configurable: true
    });
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.settle();

    expect(onRelease.mock.calls[0]![0].samples[0]!.animations).toEqual([
      "flemo-x|paused|ct=0|rate=1"
    ]);
  });

  it("survives a screen that leaves the document mid-landing", () => {
    // A committed screen unmounts while the settle is still being watched, so
    // the frames after it carry fewer poses than the frame the probe started on.
    const staying = screen(40);
    const leaving = screen(120);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.frame();
    // The one the reading is taken from is the one that goes.
    leaving.remove();
    moveTo(staying, 20);
    clock.settle();

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onRelease.mock.calls[0]![0].samples.at(-1)!.x).toHaveLength(1);
  });

  it("stops listening once detached", () => {
    screen(90);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock }).detach();

    release();
    clock.settle();

    expect(onRelease).not.toHaveBeenCalled();
  });
});
