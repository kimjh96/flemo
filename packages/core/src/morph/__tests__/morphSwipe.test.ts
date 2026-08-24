import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createNavigateStore, { type NavigateStoreApi } from "@navigate/store";

import {
  ACTIVE_ATTR,
  MORPH_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITION_ATTR
} from "@dom/attributes";

import attachMorph from "@morph/attachMorph";
import { registerMorphLayer } from "@morph/morphLayer";
import { beginMorphSwipe } from "@morph/morphSwipe";

// A DRAG-DRIVEN FLIGHT, tested at its seam.
//
// jsdom runs no animations, so what this can assert is the contract the gesture
// depends on: the flights are STAGED before any navigation exists, they are
// held at zero rather than running, the scrub moves their clock, and the
// release hands them back to the browser in the right direction. The values
// come from the animations themselves — the module owns no clock of its own,
// which is the point.

const setRect = (element: HTMLElement, x: number, y: number, width: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({})
    }) as DOMRect;
};

// jsdom implements no Web Animations, so the flight's animations are stood in
// for: one fake per element, named the way the runtime names them, recording
// what the gesture does to it.
class FakeAnimation {
  animationName: string;
  currentTime: number | null = 0;
  playbackRate = 1;
  playState: "paused" | "running" | "finished" = "running";
  plays = 0;
  private finishHandlers: (() => void)[] = [];

  constructor(name: string) {
    this.animationName = name;
  }
  pause() {
    this.playState = "paused";
  }
  // WAAPI: playing a FINISHED animation rewinds it to its start. That is the
  // behaviour that replayed a departure's cut when the gesture handed the
  // flight back, so the fake has to have it or the test cannot see it.
  duration = 700;
  play() {
    if (this.playState === "finished" || (this.currentTime ?? 0) >= this.duration) {
      this.currentTime = this.playbackRate < 0 ? this.duration : 0;
    }
    this.playState = "running";
    this.plays += 1;
  }
  addEventListener(_type: string, handler: () => void) {
    this.finishHandlers.push(handler);
  }
  finish() {
    for (const handler of this.finishHandlers.splice(0)) handler();
  }
}

let store: NavigateStoreApi;
let layer: HTMLElement;
let animations: FakeAnimation[];

const makeScreen = (active: boolean) => {
  const screen = document.createElement("div");
  screen.setAttribute(SCREEN_ATTR, "");
  screen.setAttribute(TRANSITION_ATTR, "cupertino");
  screen.setAttribute(STATUS_ATTR, "COMPLETED");
  screen.setAttribute(ACTIVE_ATTR, active ? "true" : "false");
  setRect(screen, 0, 0, 400, 800);
  document.body.appendChild(screen);
  return screen;
};

const makeMorph = (screen: HTMLElement, rect: [number, number, number, number]) => {
  const element = document.createElement("div");
  screen.appendChild(element);
  setRect(element, ...rect);
  return element;
};

beforeEach(() => {
  store = createNavigateStore();
  layer = document.createElement("div");
  setRect(layer, 0, 0, 400, 800);
  document.body.appendChild(layer);
  registerMorphLayer(store, layer);
  animations = [];
  vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => 0);
  // Every element the runtime writes an `animation` onto reports one.
  document.getAnimations = () => animations as unknown as Animation[];
  const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
  vi.spyOn(CSSStyleDeclaration.prototype, "setProperty").mockImplementation(function (
    this: CSSStyleDeclaration,
    property: string,
    value: string | null,
    priority?: string
  ) {
    if (property === "animation") {
      const name = /flemo-morph-[\w-]+/.exec(value ?? "")?.[0];
      if (name) animations.push(new FakeAnimation(name));
    }
    return originalSetProperty.call(this, property, value, priority);
  });
});

afterEach(() => {
  registerMorphLayer(store, null);
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

// The runtime writes the flyer's animation through `style.animation =`, which
// does not go through setProperty in jsdom; register that one by hand.
const captureFlyerAnimation = (element: HTMLElement) => {
  const name = /flemo-morph-[\w-]+/.exec(element.style.animation)?.[0];
  if (name) animations.push(new FakeAnimation(name));
};

describe("beginMorphSwipe", () => {
  const stage = () => {
    const detail = makeScreen(true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const gallery = makeScreen(false);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    return { hero, thumbnail, gallery };
  };

  it("stages a flight while the navigation does not exist yet", () => {
    const { thumbnail } = stage();
    // The store never goes transitional: a drag is not a navigation.
    expect(["IDLE", "COMPLETED"]).toContain(store.getState().status);

    const swipe = beginMorphSwipe(store, "POPPING");

    expect(swipe.active).toBe(true);
    // The element the swipe is returning TO is the one that flies.
    expect(layer.contains(thumbnail)).toBe(true);
    expect(thumbnail.getAttribute(MORPH_ATTR)).toBe("enter");
  });

  it("holds the flight at zero instead of letting it run", () => {
    const { thumbnail } = stage();
    captureFlyerAnimation(thumbnail);
    beginMorphSwipe(store, "POPPING");

    expect(animations.length).toBeGreaterThan(0);
    for (const animation of animations) {
      expect(animation.playState).toBe("paused");
      expect(animation.currentTime).toBe(0);
    }
  });

  it("moves every animation of the flight on one clock", () => {
    const { thumbnail } = stage();
    captureFlyerAnimation(thumbnail);
    const swipe = beginMorphSwipe(store, "POPPING");

    swipe.scrub(0.5);
    const half = animations.map((animation) => animation.currentTime);
    expect(new Set(half).size).toBe(1);
    expect(half[0]).toBeGreaterThan(0);

    swipe.scrub(1);
    const end = animations[0]!.currentTime!;
    expect(end).toBeGreaterThan(half[0]!);

    // Past either end the clock stops rather than running off it.
    swipe.scrub(2);
    expect(animations[0]!.currentTime).toBe(end);
    swipe.scrub(-1);
    expect(animations[0]!.currentTime).toBe(0);
  });

  it("plays out on a commit and back on a cancel", () => {
    const { thumbnail } = stage();
    captureFlyerAnimation(thumbnail);
    const swipe = beginMorphSwipe(store, "POPPING");
    swipe.scrub(0.6);
    swipe.settle(true, 0.2);

    for (const animation of animations) {
      expect(animation.playState).toBe("running");
      expect(animation.playbackRate).toBeGreaterThan(0);
    }
  });

  it("does not land a flight the finger is still holding", () => {
    // The landing's safety net is armed for the FLIGHT's length, and a drag
    // does not keep to it: hold one for longer than the animation would have
    // taken and the net fires, putting the element back in its screen halfway
    // through the gesture. On glass that is a shared element that shrinks with
    // the drag and then snaps home.
    vi.useFakeTimers();
    try {
      const { thumbnail } = stage();
      captureFlyerAnimation(thumbnail);
      const swipe = beginMorphSwipe(store, "POPPING");
      swipe.scrub(0.4);

      // Well past the flight's own span plus the backstop's own margin.
      vi.advanceTimersByTime(10_000);

      expect(layer.contains(thumbnail)).toBe(true);

      // The net goes back up for the release it was handed.
      swipe.settle(true, 0.2);
      vi.advanceTimersByTime(10_000);
      expect(layer.contains(thumbnail)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not replay a passenger that had already finished", () => {
    // Not every animation of a flight runs its whole length: the cut on the
    // element left behind is 17ms of a 700ms travel and is long done by the
    // time a finger lets go. Handing the flight back must not rewind it —
    // replaying a cut brings the element it hid back for a frame.
    const { thumbnail } = stage();
    captureFlyerAnimation(thumbnail);
    const swipe = beginMorphSwipe(store, "POPPING");
    swipe.scrub(0.4);

    // One passenger is already past its own end.
    const short = animations[0]!;
    short.duration = 17;
    short.currentTime = 17;
    short.playState = "finished";

    swipe.settle(true, 0.2);

    expect(short.currentTime).toBe(17);
  });

  it("brings the element home when the gesture is abandoned", () => {
    const { thumbnail } = stage();
    captureFlyerAnimation(thumbnail);
    const swipe = beginMorphSwipe(store, "POPPING");
    swipe.scrub(0.3);
    swipe.settle(false, 0.2);

    for (const animation of animations) expect(animation.playbackRate).toBeLessThan(0);
    expect(layer.contains(thumbnail)).toBe(true);

    // Backwards, an animation fires no `animationend` — the landing cannot wait
    // for one, so the flight is finished explicitly when it reaches zero.
    for (const animation of [...animations]) animation.finish();
    expect(layer.contains(thumbnail)).toBe(false);
  });
});
