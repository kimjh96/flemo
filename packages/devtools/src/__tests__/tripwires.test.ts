import { afterEach, describe, expect, it, vi } from "vitest";

import { attachTripwires, INPUT_WINDOW_MS, relativeHit, transitionBaseName } from "../tripwires";

import type { TripwireHandle, TripwireOptions } from "../tripwires";

// TRIPWIRES ARE THE THINGS THE RECORDER IS TOLD ABOUT.
//
// Every other probe samples. The three defects that cost this project the most
// lasted ONE FRAME, and a sampler that looks three times a second sees none of
// them — so these are listeners, and these tests fire the exact events the
// browser fires.

let handle: TripwireHandle | null = null;

const attach = (over: Partial<TripwireOptions> = {}) => {
  const hits: { kind: string; detail: string; atMs: number }[] = [];
  const starts: number[] = [];
  handle = attachTripwires({
    onHit: (hit) => hits.push(hit),
    onAnimationStart: (atMs) => starts.push(atMs),
    ...over
  });
  return { hits, starts };
};

// jsdom ships no `AnimationEvent` constructor, so the two fields the tripwires
// read are attached to a plain bubbling Event — which is what the listeners
// actually see.
const animation = (type: string, name: string, elapsedTime = 0.4): Event => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { animationName: name, elapsedTime });
  return event;
};

afterEach(() => {
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("animation tripwires", () => {
  it("reports a cancelled flemo animation, naming what it means", () => {
    const { hits } = attach();
    const screen = document.createElement("div");
    screen.setAttribute("data-flemo-screen", "a");
    document.body.appendChild(screen);

    screen.dispatchEvent(animation("animationcancel", "flemo-screen-cupertino-POPPING-true"));

    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("animation-cancel");
    expect(hits[0].detail).toContain("re-parented");
    expect(hits[0].detail).toContain("(screen)");
  });

  it("reports an animationend that carried no elapsed time at all", () => {
    const { hits } = attach();
    document.dispatchEvent(animation("animationend", "flemo-morph-3-travel", 0));
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("zero-length-animation-end");
    expect(hits[0].detail).toContain("without ever running");
  });

  it("describes a target that is not a screen without calling it one", () => {
    const { hits } = attach();
    const bar = document.createElement("nav");
    document.body.appendChild(bar);
    bar.dispatchEvent(animation("animationcancel", "flemo-bar-cupertino-POPPING-true"));
    expect(hits[0].detail).toContain("<nav>");
    expect(hits[0].detail).not.toContain("(screen)");
  });

  it("says nothing about an animationend that ran", () => {
    const { hits } = attach();
    document.dispatchEvent(animation("animationend", "flemo-morph-3-travel", 0.4));
    expect(hits).toEqual([]);
  });

  it("ignores a consumer's own animations entirely", () => {
    const { hits, starts } = attach();
    document.dispatchEvent(animation("animationcancel", "spin"));
    document.dispatchEvent(animation("animationend", "spin", 0));
    document.dispatchEvent(animation("animationstart", "spin"));
    expect(hits).toEqual([]);
    expect(starts).toEqual([]);
    expect(handle!.sawAnimationEvent()).toBe(false);
  });

  it("reports when the first flemo keyframe actually started", () => {
    const { starts } = attach();
    document.dispatchEvent(animation("animationstart", "flemo-screen-cupertino-PUSHING-true"));
    expect(starts).toHaveLength(1);
    expect(handle!.sawAnimationEvent()).toBe(true);
  });

  it("stops reporting once detached", () => {
    const { hits } = attach();
    handle!.detach();
    document.dispatchEvent(animation("animationcancel", "flemo-x"));
    expect(hits).toEqual([]);
  });
});

describe("what drove the navigation", () => {
  const pointer = (type: string, over: PointerEventInit = {}) =>
    new PointerEvent(type, { bubbles: true, ...over });

  it("separates a trusted finger from a script's dispatch", () => {
    attach();
    // Events built in a test are untrusted by construction, which is exactly
    // the signature a synthetic probe leaves.
    document.dispatchEvent(pointer("pointerdown", { pointerType: "touch" }));
    document.dispatchEvent(pointer("pointerdown", { pointerType: "mouse" }));

    const evidence = handle!.inputBetween(performance.now(), performance.now() + 10);
    expect(evidence.synthetic).toBe(2);
    expect(evidence.trusted).toBe(0);
    expect(evidence.pointerTypes).toEqual(["mouse", "touch"]);
  });

  it("falls back to the event's own type when the browser reports no pointer type", () => {
    attach();
    document.dispatchEvent(new Event("click", { bubbles: true }));
    expect(handle!.inputBetween(performance.now(), performance.now() + 10).pointerTypes).toEqual([
      "click"
    ]);
  });

  it("only counts input inside the window that could have caused the transition", () => {
    attach();
    document.dispatchEvent(pointer("pointerdown", { pointerType: "touch" }));
    const now = performance.now();
    // A transition that opened long after this input did not come from it.
    const evidence = handle!.inputBetween(now + INPUT_WINDOW_MS + 500, now + INPUT_WINDOW_MS + 600);
    expect(evidence.synthetic).toBe(0);
    expect(evidence.pointerTypes).toEqual([]);
  });

  it("keeps a bounded trail rather than a session's worth of events", () => {
    attach();
    for (let index = 0; index < 60; index += 1) {
      document.dispatchEvent(pointer("pointerdown", { pointerType: "touch" }));
    }
    const evidence = handle!.inputBetween(performance.now(), performance.now() + 10);
    expect(evidence.synthetic).toBeLessThanOrEqual(40);
  });
});

describe("without a document", () => {
  it("hands back an inert handle rather than making the caller branch", () => {
    const original = globalThis.document;
    // @ts-expect-error deliberately removing the global for this case
    delete globalThis.document;
    const inert = attachTripwires({ onHit: () => {}, onAnimationStart: () => {} });
    expect(inert.sawAnimationEvent()).toBe(false);
    expect(inert.inputBetween(0, 1)).toEqual({ trusted: 0, synthetic: 0, pointerTypes: [] });
    inert.detach();
    globalThis.document = original;
  });
});

describe("relativeHit", () => {
  it("puts an absolute moment back on the transition's own clock", () => {
    expect(relativeHit({ kind: "hold-reassert", detail: "x", atMs: 1041.26 }, 1000)).toEqual({
      kind: "hold-reassert",
      atMs: 41.3,
      detail: "x"
    });
  });
});

// THE ENGINE'S OWN CANCELS ARE NOT LOSSES.
//
// Measured on flemo.dev's production build, every screen transition cancelled
// its animation twice: once when a head tier swapped the bare keyframe for
// `<name>-deskhead` at the start, and once at the perceptual cut, about 93% in,
// after the screen had already flipped to COMPLETED. Both are by design (see
// cancelResume and perceptualSpan in core), and both turned every report red.

// jsdom has no Web Animations, so an element's running animations are stubbed.
const running = (element: Element, animations: { name?: string; activeMs?: number }[]) => {
  Object.assign(element, {
    getAnimations: () =>
      animations.map(({ name, activeMs = 700 }) => ({
        animationName: name,
        effect: { getComputedTiming: () => ({ activeDuration: activeMs }) }
      }))
  });
};

const screenWith = (status: string) => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", status);
  document.body.appendChild(screen);
  return screen;
};

describe("cancels the engine makes on purpose", () => {
  it("strips a head tier and a part's clock tag from a keyframe name", () => {
    expect(transitionBaseName("flemo-screen-cupertino-PUSHING-true-deskhead")).toBe(
      "flemo-screen-cupertino-PUSHING-true"
    );
    expect(transitionBaseName("flemo-part-bar-PUSHING-true-govpark-717ms")).toBe(
      "flemo-part-bar-PUSHING-true"
    );
    expect(transitionBaseName("flemo-screen-cupertino-PUSHING-true")).toBe(
      "flemo-screen-cupertino-PUSHING-true"
    );
  });

  it("says nothing about a head swap, whose successor is already running", () => {
    const { hits } = attach();
    const screen = screenWith("PUSHING");
    running(screen, [{ name: "flemo-screen-cupertino-PUSHING-true-deskhead" }]);
    screen.dispatchEvent(animation("animationcancel", "flemo-screen-cupertino-PUSHING-true", 0));
    expect(hits).toEqual([]);
  });

  it("says nothing about the landing cut, late in a resolved transition", () => {
    const { hits } = attach();
    const screen = screenWith("PUSHING");
    const name = "flemo-screen-cupertino-PUSHING-true-deskhead";
    running(screen, [{ name, activeMs: 733 }]);
    screen.dispatchEvent(animation("animationstart", name, 0));
    running(screen, []);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    screen.dispatchEvent(animation("animationcancel", name, 0.683));
    expect(hits).toEqual([]);
  });

  it("still reports a transition resolved long before its animation ended", () => {
    const { hits } = attach();
    const screen = screenWith("POPPING");
    const name = "flemo-screen-cupertino-POPPING-false";
    running(screen, [{ name, activeMs: 700 }]);
    screen.dispatchEvent(animation("animationstart", name, 0));
    running(screen, []);
    screen.setAttribute("data-flemo-status", "COMPLETED");
    screen.dispatchEvent(animation("animationcancel", name, 0.08));
    expect(hits.map((hit) => hit.kind)).toEqual(["animation-cancel"]);
  });

  it("still reports a late cancel while the transition is still moving", () => {
    const { hits } = attach();
    const screen = screenWith("PUSHING");
    const name = "flemo-screen-cupertino-PUSHING-true";
    running(screen, [{ name, activeMs: 700 }]);
    screen.dispatchEvent(animation("animationstart", name, 0));
    running(screen, []);
    screen.dispatchEvent(animation("animationcancel", name, 0.65));
    expect(hits.map((hit) => hit.kind)).toEqual(["animation-cancel"]);
  });

  it("still reports a cancel whose length it never saw start", () => {
    const { hits } = attach();
    const screen = screenWith("COMPLETED");
    // Its start was seen, but the animation was already gone when looked up;
    // what runs now is a script-driven animation with no keyframe name.
    running(screen, [{}]);
    screen.dispatchEvent(animation("animationstart", "flemo-screen-cupertino-PUSHING-true", 0));
    screen.dispatchEvent(animation("animationcancel", "flemo-screen-cupertino-PUSHING-true", 0.65));
    expect(hits.map((hit) => hit.kind)).toEqual(["animation-cancel"]);
  });
});
