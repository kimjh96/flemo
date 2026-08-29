import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createNavigateStore, { type NavigateStoreApi } from "@navigate/store";

import {
  ACTIVE_ATTR,
  MORPH_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITION_ATTR
} from "@dom/attributes";

import attachMorph, { heldFlights, stageHeldFlights } from "@morph/attachMorph";
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

  it("re-stages on the next frame when the arriving partner is a frame late", () => {
    // THE ORDER THE BINDING PRODUCES. A back-swipe's first move is also what
    // wakes the covered screen, so its <Morph> children re-register in the
    // commit that follows — after the gesture has already asked to stage. Only
    // the dismissing side exists at that moment, and it is never the one that
    // flies, so the first pass legitimately stages nothing.
    const detail = makeScreen(true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const frames: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });

    const swipe = beginMorphSwipe(store, "POPPING");
    expect(swipe.active).toBe(false);

    // The covered screen commits: its thumbnail registers.
    const gallery = makeScreen(false);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });

    for (const frame of frames.splice(0)) frame(0);
    raf.mockRestore();

    expect(swipe.active).toBe(true);
    expect(layer.contains(thumbnail)).toBe(true);
    expect(thumbnail.getAttribute(MORPH_ATTR)).toBe("enter");
  });

  it("does not spend a frame re-staging when the first pass already flew", () => {
    stage();
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");

    const swipe = beginMorphSwipe(store, "POPPING");

    expect(swipe.active).toBe(true);
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
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

  it("does not let the navigation re-fly what the gesture already delivered", () => {
    // THE RACE A FLICK LOSES. The release settle is scaled to what is left, so
    // a gesture carried to the far edge lands its morph in about 120ms while
    // the navigation it committed stages at about 150ms — and by then nothing
    // is flying, so the same element is staged again from its ORIGINAL rest
    // pose and makes the whole trip a second time. Measured on the built
    // package: land at 149ms, a fresh start at 150ms, landing again 723ms later.
    const { thumbnail } = stage();
    captureFlyerAnimation(thumbnail);
    const swipe = beginMorphSwipe(store, "POPPING");
    swipe.scrub(0.9);
    swipe.settle(true, 0.05);

    // The flight lands before the navigation gets there.
    for (const flight of heldFlights(store)) flight.finish();
    expect(heldFlights(store)).toHaveLength(0);

    // The navigation catches up and stages exactly as it always does.
    store.getState().setStatus("POPPING");
    stageHeldFlights(store, "POPPING");

    expect(heldFlights(store)).toHaveLength(0);
    expect(layer.contains(thumbnail)).toBe(false);
  });

  it("still flies for the NEXT gesture after a delivery", () => {
    const { thumbnail } = stage();
    captureFlyerAnimation(thumbnail);
    const first = beginMorphSwipe(store, "POPPING");
    first.scrub(0.9);
    first.settle(true, 0.05);
    for (const flight of heldFlights(store)) flight.finish();

    // A delivery the navigation never came to collect must not suppress the
    // gesture after it.
    const second = beginMorphSwipe(store, "POPPING");

    expect(second.active).toBe(true);
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

const makeScreenFor = (active: boolean) => {
  const screen = document.createElement("div");
  screen.setAttribute(SCREEN_ATTR, "");
  screen.setAttribute(TRANSITION_ATTR, "cupertino");
  screen.setAttribute(STATUS_ATTR, "COMPLETED");
  screen.setAttribute(ACTIVE_ATTR, active ? "true" : "false");
  setRect(screen, 0, 0, 400, 800);
  document.body.appendChild(screen);
  return screen;
};

const makeMorphIn = (parent: HTMLElement, rect: [number, number, number, number]) => {
  const element = document.createElement("div");
  parent.appendChild(element);
  setRect(element, ...rect);
  return element;
};

describe("beginMorphSwipe with nothing to fly", () => {
  it("declines a gesture on a screen pair that shares no element", () => {
    // Most swipes are exactly this: two screens with nothing in common. The
    // handle still exists — the binding calls it on every drag — and every
    // method on it has to be a no-op rather than a throw mid-gesture.
    const swipe = beginMorphSwipe(store, "POPPING");

    expect(swipe.active).toBe(false);
    expect(() => swipe.scrub(0.5)).not.toThrow();
    expect(() => swipe.settle(true, 0.2)).not.toThrow();
  });
});

describe("a released gesture", () => {
  const stageOne = () => {
    const detail = document.createElement("div");
    detail.setAttribute(SCREEN_ATTR, "");
    detail.setAttribute(TRANSITION_ATTR, "cupertino");
    detail.setAttribute(STATUS_ATTR, "COMPLETED");
    detail.setAttribute(ACTIVE_ATTR, "true");
    setRect(detail, 0, 0, 400, 800);
    document.body.appendChild(detail);
    const hero = document.createElement("div");
    detail.appendChild(hero);
    setRect(hero, 0, 0, 400, 300);
    attachMorph(hero, { layoutId: "photo-2", navigateStore: store });

    const gallery = document.createElement("div");
    gallery.setAttribute(SCREEN_ATTR, "");
    gallery.setAttribute(TRANSITION_ATTR, "cupertino");
    gallery.setAttribute(STATUS_ATTR, "COMPLETED");
    gallery.setAttribute(ACTIVE_ATTR, "false");
    setRect(gallery, 0, 0, 400, 800);
    document.body.appendChild(gallery);
    const thumbnail = document.createElement("div");
    gallery.appendChild(thumbnail);
    setRect(thumbnail, 20, 600, 80, 80);
    attachMorph(thumbnail, { layoutId: "photo-2", navigateStore: store });
    return thumbnail;
  };

  it("stops taking the finger once it has been handed back", () => {
    // The pointer stream does not stop at the release — a `pointerup` and a
    // `pointercancel` both arrive for the same gesture — and a scrub after the
    // hand-back would pause an animation the browser is already playing out.
    const thumbnail = stageOne();
    captureFlyerAnimation(thumbnail);
    const swipe = beginMorphSwipe(store, "POPPING");
    swipe.settle(true, 0.2);

    const at = animations.map((animation) => animation.currentTime);
    swipe.scrub(0.9);
    swipe.settle(false, 0.2);

    expect(animations.map((animation) => animation.currentTime)).toEqual(at);
    for (const animation of animations) expect(animation.playbackRate).toBeGreaterThan(0);
  });
});

describe("the gesture's trace", () => {
  afterEach(() => {
    sessionStorage.clear();
    delete (globalThis as { flemoMorphTrace?: unknown }).flemoMorphTrace;
  });

  it("records what it staged and what it handed back", () => {
    // A drag is the one path with no status flip behind it, so nothing else in
    // the trace says whether it staged, moved, or was handed back.
    sessionStorage.setItem("flemo:morph", "on");

    const swipe = beginMorphSwipe(store, "POPPING");
    swipe.settle(true, 0.2);

    const trace = (globalThis as { flemoMorphTrace?: { why: string }[] }).flemoMorphTrace ?? [];
    expect(trace.map((entry) => entry.why)).toContain("swipe-begin");
    expect(trace.map((entry) => entry.why)).toContain("swipe-settle-no-flight");
  });

  it("keeps the buffer to its last few hundred lines", () => {
    // A drag writes a line per pointer move if it is scrubbing anything; a
    // buffer that grew forever would be a leak on the one path that runs at
    // frame rate.
    sessionStorage.setItem("flemo:morph", "on");

    for (let index = 0; index < 520; index += 1)
      beginMorphSwipe(store, "POPPING").settle(true, 0.1);

    const trace = (globalThis as { flemoMorphTrace?: unknown[] }).flemoMorphTrace ?? [];
    expect(trace.length).toBeLessThanOrEqual(500);
    expect(trace.length).toBeGreaterThan(400);
  });
});

describe("a browser with no animation API", () => {
  it("stages the flight anyway rather than failing the gesture", () => {
    // `document.getAnimations` is what the gesture reaches the flight's clocks
    // through. Without it there is nothing to scrub, but the element is still
    // hoisted and must still be brought home.
    const detail = document.createElement("div");
    detail.setAttribute(SCREEN_ATTR, "");
    detail.setAttribute(TRANSITION_ATTR, "cupertino");
    detail.setAttribute(STATUS_ATTR, "COMPLETED");
    detail.setAttribute(ACTIVE_ATTR, "true");
    setRect(detail, 0, 0, 400, 800);
    document.body.appendChild(detail);
    const hero = document.createElement("div");
    detail.appendChild(hero);
    setRect(hero, 0, 0, 400, 300);
    attachMorph(hero, { layoutId: "photo-3", navigateStore: store });

    const gallery = document.createElement("div");
    gallery.setAttribute(SCREEN_ATTR, "");
    gallery.setAttribute(TRANSITION_ATTR, "cupertino");
    gallery.setAttribute(STATUS_ATTR, "COMPLETED");
    gallery.setAttribute(ACTIVE_ATTR, "false");
    setRect(gallery, 0, 0, 400, 800);
    document.body.appendChild(gallery);
    const thumbnail = document.createElement("div");
    gallery.appendChild(thumbnail);
    setRect(thumbnail, 20, 600, 80, 80);
    attachMorph(thumbnail, { layoutId: "photo-3", navigateStore: store });

    (document as unknown as { getAnimations?: unknown }).getAnimations = undefined;

    const swipe = beginMorphSwipe(store, "POPPING");
    expect(swipe.active).toBe(true);
    expect(() => swipe.scrub(0.5)).not.toThrow();
    expect(() => swipe.settle(false, 0.2)).not.toThrow();
  });
});

describe("a gesture in a direction with no flight in it", () => {
  it("stages nothing for a status that animates neither side", () => {
    // The direction a gesture WOULD commit is passed in rather than read from
    // the store. A caller that passes a resting status is asking for a flight
    // that has no from-pose on either side, and the answer is no flight.
    const detail = makeScreenFor(true);
    const hero = makeMorphIn(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-4", navigateStore: store });

    const gallery = makeScreenFor(false);
    const thumbnail = makeMorphIn(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-4", navigateStore: store });

    const swipe = beginMorphSwipe(store, "COMPLETED");

    expect(swipe.active).toBe(false);
    expect(layer.contains(thumbnail)).toBe(false);
  });

  it("skips a registration whose element has left the document", () => {
    // A binding unregisters in an effect cleanup, which React can run after the
    // node is already gone. Staging a flight from one would measure a rect that
    // no longer exists.
    const gallery = makeScreenFor(false);
    const orphan = makeMorphIn(gallery, [20, 600, 80, 80]);
    attachMorph(orphan, { layoutId: "photo-5", navigateStore: store });
    orphan.remove();

    expect(() => beginMorphSwipe(store, "POPPING")).not.toThrow();
  });
});

describe("a nested flight under a finger", () => {
  it("suspends and re-arms the nested landing's net with the gesture", async () => {
    // A nested morph is its own flight record with its own net, and a drag
    // outlives it just as easily as it outlives the container's: the type
    // would snap to its destination halfway through the gesture.
    vi.useFakeTimers();
    try {
      const detail = makeScreenFor(true);
      const bigCard = makeMorphIn(detail, [0, 0, 400, 340]);
      const heading = makeMorphIn(bigCard, [16, 260, 360, 32]);
      heading.style.fontSize = "24px";
      attachMorph(bigCard, { layoutId: "card-9", navigateStore: store });
      attachMorph(heading, { layoutId: "title-9", name: "text", navigateStore: store });

      const gallery = makeScreenFor(false);
      const card = makeMorphIn(gallery, [20, 600, 160, 160]);
      const label = makeMorphIn(card, [28, 730, 140, 20]);
      label.style.fontSize = "14px";
      attachMorph(card, { layoutId: "card-9", navigateStore: store });
      attachMorph(label, { layoutId: "title-9", name: "text", navigateStore: store });

      const swipe = beginMorphSwipe(store, "POPPING");
      await vi.advanceTimersByTimeAsync(0);
      swipe.scrub(0.3);

      // Long past the flight's own span: the finger is still down.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(label.getAttribute(MORPH_ATTR)).toBe("enter");

      swipe.settle(true, 0.2);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(label.getAttribute(MORPH_ATTR)).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });
});
