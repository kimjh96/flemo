import { afterEach, describe, expect, it, vi } from "vitest";

import { attachSwipeProbe, releasedScreens, SWIPE_PROBE_MS } from "../swipeProbe";

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
        { animationName: undefined, playState: "running", currentTime: 210, playbackRate: -0.5 }
      ],
      configurable: true
    });
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock });

    release();
    clock.settle();

    const audit = onRelease.mock.calls[0]![0];
    expect(audit.samples[0]!.animations).toEqual(["waapi|running|ct=210|rate=-0.5"]);
  });

  it("reads the release off the screen that travels furthest", () => {
    // cupertino moves the covered screen a third as far. Averaging the two
    // would flatten every ratio this reports.
    const dragged = screen(120);
    const covered = screen(-40);
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

  it("stops listening once detached", () => {
    screen(90);
    const onRelease = vi.fn();
    const clock = rig();
    attachSwipeProbe({ onRelease, ...clock }).detach();

    release();
    clock.settle();

    expect(onRelease).not.toHaveBeenCalled();
  });

  it("names the screens a release is about", () => {
    screen(50);
    expect(releasedScreens()).toEqual([{ id: "s1", status: "COMPLETED", active: "true" }]);
  });
});
