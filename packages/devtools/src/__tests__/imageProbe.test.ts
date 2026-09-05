import { afterEach, describe, expect, it } from "vitest";

import {
  createImageProbeState,
  imageActivity,
  snapshotHeldImages,
  trackAddedImages
} from "../imageProbe";

// A still-loading image that completes DURING a flight decodes and
// first-rasters on the moving layer, at a glass-measured cost of one skipped
// present. The engine holds those images; what this probe watches for is a
// completion WITHOUT a hold.

const screen = (): HTMLElement => {
  const element = document.createElement("div");
  element.setAttribute("data-flemo-screen", "a");
  document.body.appendChild(element);
  return element;
};

const image = (parent: HTMLElement, complete: boolean): HTMLImageElement => {
  const img = document.createElement("img");
  Object.defineProperty(img, "complete", { value: complete, configurable: true });
  parent.appendChild(img);
  return img;
};

const nodes = (list: Node[]): NodeList => list as unknown as NodeList;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the image probe", () => {
  it("tracks only what was still loading when the flight opened", () => {
    const a = screen();
    image(a, true);
    image(a, false);
    const state = createImageProbeState([a]);
    expect(state.loadingAtStart).toBe(1);
  });

  it("counts a completion without a hold, per image", () => {
    const a = screen();
    const held = image(a, false);
    const unheld = image(a, false);
    const state = createImageProbeState([a]);

    held.setAttribute("data-flemo-img-hold", "");
    snapshotHeldImages(state, [a]);
    // Both finish before the flight ends; only one of them was parked.
    Object.defineProperty(held, "complete", { value: true, configurable: true });
    Object.defineProperty(unheld, "complete", { value: true, configurable: true });

    const activity = imageActivity(state);
    expect(activity.completedDuringFlight).toBe(2);
    expect(activity.heldDuringFlight).toBe(1);
    expect(activity.completedUnheld).toBe(1);
  });

  it("picks up an image that arrives inside a participant mid-flight", () => {
    const a = screen();
    const state = createImageProbeState([a]);
    const wrapper = document.createElement("div");
    const late = image(wrapper, false);
    a.appendChild(wrapper);

    trackAddedImages(state, [a], nodes([wrapper]));
    expect(state.addedDuringFlight).toBe(1);
    expect(state.tracked.has(late)).toBe(true);
  });

  it("ignores an image that arrives outside the flight's participants", () => {
    const a = screen();
    const elsewhere = document.createElement("div");
    document.body.appendChild(elsewhere);
    const state = createImageProbeState([a]);

    const stray = document.createElement("div");
    image(stray, false);
    elsewhere.appendChild(stray);
    trackAddedImages(state, [a], nodes([stray]));
    expect(state.addedDuringFlight).toBe(0);
  });

  it("ignores non-element nodes and images that already finished", () => {
    const a = screen();
    const state = createImageProbeState([a]);
    trackAddedImages(state, [a], nodes([document.createTextNode("x")]));
    const done = image(a, true);
    trackAddedImages(state, [a], nodes([done]));
    expect(state.addedDuringFlight).toBe(0);
  });

  // THE PROBE MUST NEVER BECOME THE COST IT MEASURES. A list commit can append
  // hundreds of images at once, and past the cap the sample is already
  // conclusive either way.
  it("stops tracking past its ceiling, and stays stopped", () => {
    const a = screen();
    const state = createImageProbeState([a]);
    const batch = document.createElement("div");
    for (let index = 0; index < 260; index += 1) image(batch, false);
    a.appendChild(batch);

    trackAddedImages(state, [a], nodes([batch]));
    expect(state.tracked.size).toBe(200);

    // A second commit finds the ceiling already reached and returns at once.
    const more = document.createElement("div");
    image(more, false);
    a.appendChild(more);
    trackAddedImages(state, [a], nodes([more]));
    expect(state.tracked.size).toBe(200);
    expect(state.addedDuringFlight).toBe(200);
  });
});
